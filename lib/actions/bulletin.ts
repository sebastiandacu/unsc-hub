"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { notifyAllUsers, notifyMany } from "@/lib/notify";
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
  /// Visibility
  postToDiscord: z.boolean().optional(),
  pingEveryone: z.boolean().optional(),
  /// Empty / undefined = public. Non-empty = restricted to members of these teams.
  restrictedTeamIds: z.array(z.string()).optional(),
});

/**
 * Resolve which users should get an in-app notification:
 *   - public: all users (notifyAllUsers)
 *   - restricted: holders of any slot in the restricted teams (deduped)
 */
async function notifyForBulletin(
  restrictedTeamIds: string[],
  exceptUserId: string,
  payload: Parameters<typeof notifyMany>[1],
) {
  if (restrictedTeamIds.length === 0) {
    await notifyAllUsers(payload, exceptUserId);
    return;
  }
  const slots = await prisma.teamSlot.findMany({
    where: { teamId: { in: restrictedTeamIds }, holderId: { not: null } },
    select: { holderId: true },
  });
  const userIds = Array.from(
    new Set(slots.map((s) => s.holderId!).filter((id) => id !== exceptUserId)),
  );
  if (userIds.length === 0) return;
  await notifyMany(userIds, payload);
}

export async function createBulletin(input: z.infer<typeof createSchema>) {
  const user = await requirePermission("LICENSED");
  const data = createSchema.parse(input);
  const postToDiscordFlag = data.postToDiscord ?? true;
  const pingEveryoneFlag = data.pingEveryone ?? true;
  const restrictedTeamIds = data.restrictedTeamIds ?? [];

  const post = await prisma.bulletinPost.create({
    data: {
      authorId: user.id,
      title: data.title,
      bodyJson: data.bodyJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      pinned: !!data.pinned,
      postToDiscord: postToDiscordFlag,
      pingEveryone: pingEveryoneFlag,
      restrictedTeams:
        restrictedTeamIds.length > 0
          ? { connect: restrictedTeamIds.map((id) => ({ id })) }
          : undefined,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "bulletin.create",
      targetType: "BulletinPost",
      targetId: post.id,
      payloadJson: {
        postToDiscord: postToDiscordFlag,
        pingEveryone: pingEveryoneFlag,
        restrictedTeamCount: restrictedTeamIds.length,
      },
    },
  });

  // Restricted bulletins get a "🔒" suffix in titles so it's obvious
  // in feeds and Discord that this isn't a unit-wide post.
  const restrictedSuffix = restrictedTeamIds.length > 0 ? " 🔒" : "";
  const restrictedNames =
    restrictedTeamIds.length > 0
      ? (
          await prisma.team.findMany({
            where: { id: { in: restrictedTeamIds } },
            select: { name: true },
          })
        )
          .map((t) => t.name)
          .join(", ")
      : "";

  await Promise.allSettled([
    notifyForBulletin(restrictedTeamIds, user.id, {
      kind: "bulletin.posted",
      title: data.pinned
        ? `📌 Boletín pineado${restrictedSuffix}: ${data.title}`
        : `Nuevo boletín${restrictedSuffix}: ${data.title}`,
      url: `/bulletin/${post.id}`,
    }),
    postToDiscordFlag
      ? postToDiscord(
          {
            title: data.pinned ? `📌 ${data.title}${restrictedSuffix}` : `${data.title}${restrictedSuffix}`,
            description: [
              `Nuevo boletín publicado por **${user.nickname ?? user.discordUsername ?? "Operativo"}**.`,
              restrictedNames ? `🔒 Restringido a: **${restrictedNames}**` : "",
              "",
              `**[Leer en el HUB →](${absoluteUrl(`/bulletin/${post.id}`)})**`,
            ]
              .filter(Boolean)
              .join("\n"),
            url: absoluteUrl(`/bulletin/${post.id}`),
            footer: "BOLETÍN · HUB",
          },
          { mentionEveryone: pingEveryoneFlag && restrictedTeamIds.length === 0 },
        )
      : Promise.resolve(),
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
  const restrictedTeamIds = data.restrictedTeamIds ?? [];

  await prisma.bulletinPost.update({
    where: { id: postId },
    data: {
      title: data.title,
      bodyJson: data.bodyJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      pinned: !!data.pinned,
      postToDiscord: data.postToDiscord ?? true,
      pingEveryone: data.pingEveryone ?? true,
      // Replace the restricted-teams set entirely.
      restrictedTeams: { set: restrictedTeamIds.map((id) => ({ id })) },
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
