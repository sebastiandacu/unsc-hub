/**
 * Server-side notification creator. Used inside server actions.
 * Cheap fan-out: with ≤30 users we just batch insert via createMany.
 */

import { prisma } from "@/lib/db";

export type NotifyInput = {
  kind: string;
  title: string;
  body?: string | null;
  url?: string | null;
};

export async function notify(userId: string, n: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      url: n.url ?? null,
    },
  });
}

export async function notifyMany(userIds: string[], n: NotifyInput): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      url: n.url ?? null,
    })),
  });
}

export async function notifyAdmins(n: NotifyInput, exceptUserId?: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { permission: "ADMIN", banned: false, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    select: { id: true },
  });
  await notifyMany(admins.map((a) => a.id), n);
}

export async function notifyAllUsers(n: NotifyInput, exceptUserId?: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { banned: false, lastSeenAt: { not: null }, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    select: { id: true },
  });
  await notifyMany(users.map((u) => u.id), n);
}
