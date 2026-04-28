"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { notifyAllUsers } from "@/lib/notify";
import { absoluteUrl, postToDiscord } from "@/lib/discord-webhook";
import { fanOutMentions } from "@/lib/mentions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docSchema: z.ZodType<any> = z.record(z.string(), z.any());

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  bodyJson: docSchema,
  headerImageUrl: z.string().url().optional().nullable(),
  bannerImageUrl: z.string().url().optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function createBulletin(input: z.infer<typeof createSchema>) {
  const user = await requirePermission("LICENSED");
  const data = createSchema.parse(input);
  const post = await prisma.bulletinPost.create({
    data: {
      authorId: user.id,
      title: data.title,
      bodyJson: data.bodyJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      pinned: !!data.pinned,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "bulletin.create", targetType: "BulletinPost", targetId: post.id },
  });

  // Fan out notifications + cross-post to Discord (best-effort, non-blocking on errors).
  await Promise.allSettled([
    notifyAllUsers(
      {
        kind: "bulletin.posted",
        title: data.pinned ? `📌 Nuevo bulletin pineado: ${data.title}` : `Nuevo bulletin: ${data.title}`,
        url: `/bulletin/${post.id}`,
      },
      user.id,
    ),
    postToDiscord(
      {
        title: data.pinned ? `📌 ${data.title}` : data.title,
        description: `Nuevo boletín publicado por **${user.nickname ?? user.discordUsername ?? "Operativo"}**.\n\n**[Leer en el HUB →](${absoluteUrl(`/bulletin/${post.id}`)})**`,
        url: absoluteUrl(`/bulletin/${post.id}`),
        footer: "BOLETÍN · HUB",
      },
      { mentionEveryone: true },
    ),
    fanOutMentions(data.bodyJson, {
      authorId: user.id,
      authorName: user.nickname ?? user.discordUsername ?? "Operative",
      surface: "bulletin",
      title: data.title,
      url: `/bulletin/${post.id}`,
    }),
  ]);

  revalidatePath("/bulletin");
  redirect(`/bulletin/${post.id}`);
}

export async function updateBulletin(postId: string, input: z.infer<typeof createSchema>) {
  const user = await requirePermission("LICENSED");
  const data = createSchema.parse(input);
  await prisma.bulletinPost.update({
    where: { id: postId },
    data: {
      title: data.title,
      bodyJson: data.bodyJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      pinned: !!data.pinned,
      editedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "bulletin.update", targetType: "BulletinPost", targetId: postId },
  });
  revalidatePath("/bulletin");
  revalidatePath(`/bulletin/${postId}`);
}

export async function togglePin(postId: string) {
  const user = await requirePermission("LICENSED");
  const post = await prisma.bulletinPost.findUnique({ where: { id: postId }, select: { pinned: true } });
  if (!post) throw new Error("Not found");
  await prisma.bulletinPost.update({ where: { id: postId }, data: { pinned: !post.pinned } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: post.pinned ? "bulletin.unpin" : "bulletin.pin", targetType: "BulletinPost", targetId: postId },
  });
  revalidatePath("/bulletin");
  revalidatePath(`/bulletin/${postId}`);
}

export async function deleteBulletin(postId: string) {
  const user = await requirePermission("LICENSED");
  await prisma.bulletinPost.delete({ where: { id: postId } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "bulletin.delete", targetType: "BulletinPost", targetId: postId },
  });
  revalidatePath("/bulletin");
  redirect("/bulletin");
}

export async function markRead(postId: string) {
  const user = await requireUser();
  await prisma.bulletinRead.upsert({
    where: { postId_userId: { postId, userId: user.id } },
    create: { postId, userId: user.id },
    update: { readAt: new Date() },
  });
}
