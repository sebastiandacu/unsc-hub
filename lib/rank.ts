import { prisma } from "@/lib/db";

export type ResolvedRank = {
  label: string;
  priority: number | null;
  source: "manual" | "discord" | "none";
};

/**
 * Resolve the rank shown on a user profile.
 * Order of precedence:
 *   1. User.manualRankOverride (admin-set)
 *   2. Highest-priority Discord role they currently hold
 *   3. None
 */
export async function resolveRank(userId: string): Promise<ResolvedRank> {
  const [user, snapshot, priorities] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { manualRankOverride: true } }),
    prisma.discordRoleSnapshot.findUnique({ where: { userId } }),
    prisma.discordRolePriority.findMany({ orderBy: { priorityOrder: "asc" } }),
  ]);

  if (user?.manualRankOverride) {
    return { label: user.manualRankOverride, priority: null, source: "manual" };
  }

  if (snapshot && priorities.length > 0) {
    const held = new Set(snapshot.roleIds);
    const match = priorities.find((p) => held.has(p.roleId));
    if (match) return { label: match.displayLabel, priority: match.priorityOrder, source: "discord" };
  }

  return { label: "Unranked", priority: null, source: "none" };
}
