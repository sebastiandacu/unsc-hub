"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export async function listMyNotifications(limit = 20) {
  const user = await requireUser();
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return { items, unreadCount };
}

/**
 * Mark a single notification as read (used as a "seen" tick before navigation).
 * Kept for back-compat / link clicks where we want to record intent before redirect.
 */
export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/**
 * Delete a single notification by id (the user is done with it).
 */
export async function dismissNotification(id: string) {
  const user = await requireUser();
  await prisma.notification.deleteMany({
    where: { id, userId: user.id },
  });
  revalidatePath("/", "layout");
}

/**
 * Clear (delete) every notification the user owns.
 * Used by "Marcar todo leído" and on bell-panel close.
 */
export async function clearAllNotifications() {
  const user = await requireUser();
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  revalidatePath("/", "layout");
}

/**
 * Legacy alias — mark everything read without deleting.
 * Currently unused by the bell, kept so older imports don't break.
 */
export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
