/**
 * Visibility helpers for restricted bulletins/events.
 *
 * A bulletin/event with no entries in its restrictedTeams relation is
 * public. With entries, only:
 *   - admins, or
 *   - users who hold a slot in any of the listed teams
 * can see it (in list pages, in the dashboard, or by direct URL).
 *
 * The Prisma where-fragment returned by `bulletinVisibilityWhere` and
 * `eventVisibilityWhere` is meant to be merged into your existing
 * `where` filter via spread.
 */

import { prisma } from "@/lib/db";

/** All distinct team IDs the user currently holds a slot in. */
export async function teamIdsForUser(userId: string): Promise<string[]> {
  const slots = await prisma.teamSlot.findMany({
    where: { holderId: userId },
    select: { teamId: true },
    distinct: ["teamId"],
  });
  return slots.map((s) => s.teamId);
}

/**
 * Where-fragment that allows: (a) anything with no restrictions, OR
 * (b) anything restricted to at least one of the user's teams.
 * Returns `{}` (no filtering) when isAdmin is true.
 */
export async function bulletinVisibilityWhere(
  userId: string,
  isAdmin: boolean,
) {
  if (isAdmin) return {};
  const teamIds = await teamIdsForUser(userId);
  return {
    OR: [
      { restrictedTeams: { none: {} } },
      ...(teamIds.length > 0
        ? [{ restrictedTeams: { some: { id: { in: teamIds } } } }]
        : []),
    ],
  };
}

export async function eventVisibilityWhere(userId: string, isAdmin: boolean) {
  if (isAdmin) return {};
  const teamIds = await teamIdsForUser(userId);
  return {
    OR: [
      { restrictedTeams: { none: {} } },
      ...(teamIds.length > 0
        ? [{ restrictedTeams: { some: { id: { in: teamIds } } } }]
        : []),
    ],
  };
}

/**
 * Direct-URL access guard. Throws when a non-admin tries to view a
 * post they shouldn't see.
 */
export async function assertCanSeeBulletin(
  postId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const post = await prisma.bulletinPost.findUnique({
    where: { id: postId },
    select: { restrictedTeams: { select: { id: true } } },
  });
  if (!post) return; // 404 is fine, the page will handle it
  if (post.restrictedTeams.length === 0) return; // public
  const teamIds = await teamIdsForUser(userId);
  const ok = post.restrictedTeams.some((t) => teamIds.includes(t.id));
  if (!ok) throw new Error("Boletín restringido — no autorizado.");
}

export async function assertCanSeeEvent(
  eventId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) return;
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { restrictedTeams: { select: { id: true } } },
  });
  if (!ev) return;
  if (ev.restrictedTeams.length === 0) return;
  const teamIds = await teamIdsForUser(userId);
  const ok = ev.restrictedTeams.some((t) => teamIds.includes(t.id));
  if (!ok) throw new Error("Evento restringido — no autorizado.");
}
