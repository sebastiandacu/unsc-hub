"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { ALLOWED_EMOJIS, type Emoji } from "@/lib/reactions";

export async function toggleReaction(threadId: string, emoji: string, categorySlug: string) {
  const user = await requireUser();
  if (!ALLOWED_EMOJIS.includes(emoji as Emoji)) throw new Error("Invalid emoji");

  const existing = await prisma.wallReaction.findUnique({
    where: { threadId_userId_emoji: { threadId, userId: user.id, emoji } },
  });

  if (existing) {
    await prisma.wallReaction.delete({
      where: { threadId_userId_emoji: { threadId, userId: user.id, emoji } },
    });
  } else {
    await prisma.wallReaction.create({
      data: { threadId, userId: user.id, emoji },
    });
  }
  revalidatePath(`/wall/${categorySlug}/${threadId}`);
}
