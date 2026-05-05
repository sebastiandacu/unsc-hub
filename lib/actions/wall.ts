"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { fanOutMentions } from "@/lib/mentions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docSchema: z.ZodType<any> = z.record(z.string(), z.any());

const threadSchema = z.object({
  categorySlug: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  bodyJson: docSchema,
  headerImageUrl: z.string().url().optional().nullable(),
  bannerImageUrl: z.string().url().optional().nullable(),
});

/**
 * Tiptap converts pasted images into <img src="data:image/...;base64,...">.
 * Even a few pasted screenshots inflate the bodyJson into multi-MB
 * payloads that fail Server Action body limits + Postgres JSON writes
 * with cryptic Prisma errors. We reject early with a clear message that
 * tells the user to use the upload button instead.
 *
 * Also catches the bytesize-without-base64 case (e.g. a giant base64
 * pasted as plain text in a paragraph) by rejecting any single doc
 * over 5MB of serialized JSON.
 */
function rejectBase64Images(doc: unknown): void {
  const seen = JSON.stringify(doc);
  if (seen.includes("data:image") || seen.includes("data:application")) {
    throw new Error(
      "Detecté contenido binario pegado en el cuerpo (data: URLs). Pegar imágenes/archivos del portapapeles infla el post a varios MB y rompe el guardado. Usá el botón 📷 del editor para subir las imágenes.",
    );
  }
  if (seen.length > 5_000_000) {
    throw new Error(
      `El cuerpo del post pesa ${(seen.length / 1_000_000).toFixed(1)} MB, demasiado para guardar. Achicalo o dividilo en varios posts.`,
    );
  }
}

export async function createThread(input: z.infer<typeof threadSchema>) {
  const user = await requireUser();
  const data = threadSchema.parse(input);
  rejectBase64Images(data.bodyJson);
  const category = await prisma.wallCategory.findUnique({ where: { slug: data.categorySlug } });
  if (!category) throw new Error("Category not found");
  const thread = await prisma.wallThread.create({
    data: {
      categoryId: category.id,
      authorId: user.id,
      title: data.title,
      bodyJson: data.bodyJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
    },
  });
  await fanOutMentions(data.bodyJson, {
    authorId: user.id,
    authorName: user.nickname ?? user.discordUsername ?? "Operative",
    surface: "thread",
    title: data.title,
    url: `/wall/${data.categorySlug}/${thread.id}`,
  }).catch(() => {});
  revalidatePath(`/wall/${data.categorySlug}`);
  redirect(`/wall/${data.categorySlug}/${thread.id}`);
}

const replySchema = z.object({
  threadId: z.string().min(1),
  bodyJson: docSchema,
});

export async function postReply(input: z.infer<typeof replySchema>) {
  const user = await requireUser();
  const data = replySchema.parse(input);
  rejectBase64Images(data.bodyJson);
  const thread = await prisma.wallThread.findUnique({
    where: { id: data.threadId },
    select: { lockedByAdminId: true, category: { select: { slug: true } } },
  });
  if (!thread) throw new Error("Thread not found");
  if (thread.lockedByAdminId) throw new Error("Thread is locked");
  await prisma.wallReply.create({
    data: {
      threadId: data.threadId,
      authorId: user.id,
      bodyJson: data.bodyJson,
    },
  });
  const fullThread = await prisma.wallThread.findUnique({
    where: { id: data.threadId },
    select: { title: true },
  });
  await fanOutMentions(data.bodyJson, {
    authorId: user.id,
    authorName: user.nickname ?? user.discordUsername ?? "Operative",
    surface: "reply",
    title: fullThread?.title ?? "thread",
    url: `/wall/${thread.category.slug}/${data.threadId}`,
  }).catch(() => {});
  revalidatePath(`/wall/${thread.category.slug}/${data.threadId}`);
}

export async function toggleLockThread(threadId: string) {
  const admin = await requireAdmin();
  const thread = await prisma.wallThread.findUnique({
    where: { id: threadId },
    select: { lockedByAdminId: true, category: { select: { slug: true } } },
  });
  if (!thread) throw new Error("Not found");
  await prisma.wallThread.update({
    where: { id: threadId },
    data: { lockedByAdminId: thread.lockedByAdminId ? null : admin.id },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: thread.lockedByAdminId ? "wall.unlock" : "wall.lock",
      targetType: "WallThread",
      targetId: threadId,
    },
  });
  revalidatePath(`/wall/${thread.category.slug}/${threadId}`);
}

export async function deleteThread(threadId: string) {
  const admin = await requireAdmin();
  const thread = await prisma.wallThread.findUnique({
    where: { id: threadId },
    select: { category: { select: { slug: true } } },
  });
  if (!thread) throw new Error("Not found");
  await prisma.wallReply.deleteMany({ where: { threadId } });
  await prisma.wallThread.delete({ where: { id: threadId } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "wall.deleteThread", targetType: "WallThread", targetId: threadId },
  });
  revalidatePath(`/wall/${thread.category.slug}`);
  redirect(`/wall/${thread.category.slug}`);
}

const threadEditSchema = z.object({
  title: z.string().trim().min(1).max(200),
  bodyJson: docSchema,
  headerImageUrl: z.string().url().optional().nullable(),
  bannerImageUrl: z.string().url().optional().nullable(),
});

export async function updateThread(threadId: string, input: z.infer<typeof threadEditSchema>) {
  const user = await requireUser();
  const data = threadEditSchema.parse(input);
  rejectBase64Images(data.bodyJson);
  const thread = await prisma.wallThread.findUnique({
    where: { id: threadId },
    select: { authorId: true, category: { select: { slug: true } } },
  });
  if (!thread) throw new Error("Not found");
  const isAdmin = user.permission === "ADMIN";
  if (thread.authorId !== user.id && !isAdmin) throw new Error("Forbidden");
  await prisma.wallThread.update({
    where: { id: threadId },
    data: {
      title: data.title,
      bodyJson: data.bodyJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      editedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "wall.editThread", targetType: "WallThread", targetId: threadId },
  });
  revalidatePath(`/wall/${thread.category.slug}/${threadId}`);
  revalidatePath(`/wall/${thread.category.slug}`);
}

const replyEditSchema = z.object({
  bodyJson: docSchema,
});

export async function updateReply(replyId: string, input: z.infer<typeof replyEditSchema>) {
  const user = await requireUser();
  const data = replyEditSchema.parse(input);
  rejectBase64Images(data.bodyJson);
  const reply = await prisma.wallReply.findUnique({
    where: { id: replyId },
    include: { thread: { select: { id: true, category: { select: { slug: true } } } } },
  });
  if (!reply) throw new Error("Not found");
  const isAdmin = user.permission === "ADMIN";
  if (reply.authorId !== user.id && !isAdmin) throw new Error("Forbidden");
  await prisma.wallReply.update({
    where: { id: replyId },
    data: { bodyJson: data.bodyJson, editedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "wall.editReply", targetType: "WallReply", targetId: replyId },
  });
  revalidatePath(`/wall/${reply.thread.category.slug}/${reply.thread.id}`);
}

export async function togglePinThread(threadId: string) {
  const admin = await requireAdmin();
  const thread = await prisma.wallThread.findUnique({
    where: { id: threadId },
    select: { pinned: true, category: { select: { slug: true } } },
  });
  if (!thread) throw new Error("Not found");
  await prisma.wallThread.update({
    where: { id: threadId },
    data: { pinned: !thread.pinned },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: thread.pinned ? "wall.unpinThread" : "wall.pinThread",
      targetType: "WallThread",
      targetId: threadId,
    },
  });
  revalidatePath(`/wall/${thread.category.slug}`);
  revalidatePath(`/wall/${thread.category.slug}/${threadId}`);
}

export async function deleteReply(replyId: string) {
  const admin = await requireAdmin();
  const reply = await prisma.wallReply.findUnique({
    where: { id: replyId },
    include: { thread: { select: { id: true, category: { select: { slug: true } } } } },
  });
  if (!reply) throw new Error("Not found");
  await prisma.wallReply.delete({ where: { id: replyId } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "wall.deleteReply", targetType: "WallReply", targetId: replyId },
  });
  revalidatePath(`/wall/${reply.thread.category.slug}/${reply.thread.id}`);
}
