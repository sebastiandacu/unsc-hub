import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Permission, User } from "@prisma/client";

const ORDER: Record<Permission, number> = {
  AUTHORIZED:   0,
  LICENSED:     1,
  CERTIFICATED: 2,
  ADMIN:        3,
};

// Cached per-request: layout + page + nested guards all share one DB hit.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.banned) redirect("/login");
  return user;
}

export async function requirePermission(min: Permission): Promise<User> {
  const user = await requireUser();
  if (ORDER[user.permission] < ORDER[min]) redirect("/dashboard?denied=1");
  return user;
}

export async function requireAdmin(): Promise<User> {
  return requirePermission("ADMIN");
}

export function hasPermission(user: { permission: Permission }, min: Permission): boolean {
  return ORDER[user.permission] >= ORDER[min];
}
