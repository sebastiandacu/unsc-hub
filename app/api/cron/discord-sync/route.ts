import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchGuildMember } from "@/lib/discord";

/**
 * Refreshes DiscordRoleSnapshot for every active user. Authenticated by either
 * Vercel's CRON_SECRET (Authorization: Bearer ...) or a matching `?secret=`.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("secret");
  if (provided !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { banned: false, discordId: { not: null } },
    select: { id: true, discordId: true },
  });

  let ok = 0;
  let missing = 0;
  for (const u of users) {
    if (!u.discordId) continue;
    try {
      const member = await fetchGuildMember(u.discordId);
      await prisma.discordRoleSnapshot.upsert({
        where: { userId: u.id },
        create: { userId: u.id, roleIds: member?.roles ?? [], inGuild: !!member },
        update: { roleIds: member?.roles ?? [], inGuild: !!member, rolesFetchedAt: new Date() },
      });
      if (member) ok++; else missing++;
    } catch {
      missing++;
    }
  }
  return NextResponse.json({ total: users.length, ok, missing, ranAt: new Date().toISOString() });
}
