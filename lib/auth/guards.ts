import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Permission, User } from "@prisma/client";

const ORDER: Record<Permission, number> = {
  AUTHORIZED: 0,
  LICENSED:   1,
  OFFICER:    2,
  ADMIN:      3,
};

/**
 * True when `actor` outranks `target` (strictly higher in the chain).
 * Used by OFFICER-level admin actions: an officer can edit AUTHORIZED
 * and LICENSED users, but not other officers or admins. Editing self
 * is always allowed by callers — this helper doesn't special-case it.
 */
export function outranks(
  actor: { permission: Permission },
  target: { permission: Permission },
): boolean {
  return ORDER[actor.permission] > ORDER[target.permission];
}

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

/**
 * Require the viewer to be at least OFFICER AND outrank the target user.
 * Throws (caught upstream as a server-action error string) when the rank
 * gate fails — admins can edit anyone; officers can edit AUTHORIZED and
 * LICENSED; nobody else can hit these endpoints.
 *
 * Self-editing is always allowed because the user-facing /profile flow
 * doesn't go through these admin actions anyway.
 */
export async function requireRankOverUser(targetUserId: string): Promise<{
  actor: User;
  target: User;
}> {
  const actor = await requirePermission("OFFICER");
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Usuario no encontrado.");
  if (actor.id === target.id) return { actor, target };
  if (actor.permission !== "ADMIN" && !outranks(actor, target)) {
    throw new Error(
      `Solo podés editar a un operativo de rango menor (tu rango: ${actor.permission}, target: ${target.permission}).`,
    );
  }
  return { actor, target };
}

export function hasPermission(user: { permission: Permission }, min: Permission): boolean {
  return ORDER[user.permission] >= ORDER[min];
}
