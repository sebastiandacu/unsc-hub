import { prisma } from "@/lib/db";

/**
 * Fetch the full priority→label map for resolving `minRankPriority` integers
 * into display labels ("Field Agent", etc.) in the UI.
 */
export async function getRankLabelMap(): Promise<Map<number, string>> {
  const priorities = await prisma.discordRolePriority.findMany({
    select: { priorityOrder: true, displayLabel: true },
  });
  return new Map(priorities.map((p) => [p.priorityOrder, p.displayLabel]));
}

export function rankLabel(
  priority: number | null | undefined,
  map: Map<number, string> | Record<number, string>,
): string | null {
  if (priority == null) return null;
  const label =
    map instanceof Map ? map.get(priority) : (map as Record<number, string>)[priority];
  return label ?? `#${priority}`;
}
