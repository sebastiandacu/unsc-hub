"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export type SearchHit = {
  kind: "user" | "team" | "bulletin" | "thread";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
};

export async function searchAll(query: string): Promise<SearchHit[]> {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  const [users, teams, bulletins, threads] = await Promise.all([
    prisma.user.findMany({
      where: {
        banned: false,
        OR: [
          { nickname: { contains: q, mode: "insensitive" } },
          { discordUsername: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, nickname: true, discordUsername: true, permission: true },
      take: 5,
    }),
    prisma.team.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { callsign: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, callsign: true },
      take: 5,
    }),
    prisma.bulletinPost.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.wallThread.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, category: { select: { slug: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const hits: SearchHit[] = [];
  for (const u of users) {
    hits.push({
      kind: "user",
      id: u.id,
      title: u.nickname ?? u.discordUsername ?? u.id,
      subtitle: u.permission,
      url: `/roster/${u.id}`,
    });
  }
  for (const t of teams) {
    hits.push({
      kind: "team",
      id: t.id,
      title: t.name,
      subtitle: t.callsign ?? undefined,
      url: `/roster/teams/${t.id}`,
    });
  }
  for (const b of bulletins) {
    hits.push({
      kind: "bulletin",
      id: b.id,
      title: b.title,
      subtitle: new Date(b.createdAt).toLocaleDateString("es-ES"),
      url: `/bulletin/${b.id}`,
    });
  }
  for (const th of threads) {
    hits.push({
      kind: "thread",
      id: th.id,
      title: th.title,
      subtitle: th.category.name,
      url: `/wall/${th.category.slug}/${th.id}`,
    });
  }
  return hits;
}
