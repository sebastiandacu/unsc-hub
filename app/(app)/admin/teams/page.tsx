import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { TeamsAdmin } from "./TeamsAdmin";

export default async function AdminTeamsPage() {
  await requireAdmin();
  const [teams, applications, users, priorities, categories] = await Promise.all([
    prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        slots: {
          orderBy: { sortOrder: "asc" },
          include: { holder: { select: { id: true, nickname: true, discordUsername: true } } },
        },
        bans: {
          include: {
            user: { select: { id: true, nickname: true, discordUsername: true } },
            bannedBy: { select: { nickname: true, discordUsername: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.teamApplication.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        applicant: { select: { id: true, nickname: true, discordUsername: true } },
        slot: { include: { team: { select: { id: true, name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { banned: false },
      orderBy: [{ nickname: "asc" }, { discordUsername: "asc" }],
      select: { id: true, nickname: true, discordUsername: true },
    }),
    prisma.discordRolePriority.findMany({
      orderBy: { priorityOrder: "asc" },
      select: { priorityOrder: true, displayLabel: true },
    }),
    prisma.teamCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { teams: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · ESTRUCTURA"
        title="Equipos."
        description="Crear categorías y equipos, configurar slots, revisar solicitudes, gestionar bans."
        stamps={[
          { label: `▸ ${categories.length} CAT.`, tone: "muted" },
          { label: `▸ ${teams.length} EQ.`, tone: "muted" },
        ]}
      />
      <div className="px-7 pb-7 space-y-6">
        <TeamsAdmin
          users={users.map((u) => ({
            id: u.id,
            name: u.nickname ?? u.discordUsername ?? u.id,
          }))}
          priorities={priorities}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            color: c.color,
            logoUrl: c.logoUrl,
            sortOrder: c.sortOrder,
            teamCount: c._count.teams,
          }))}
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            callsign: t.callsign,
            color: t.color,
            logoUrl: t.logoUrl,
            description: t.description,
            allowsMultiMembership: t.allowsMultiMembership,
            minRankPriority: t.minRankPriority,
            teamType: t.teamType,
            categoryId: t.categoryId,
            slots: t.slots.map((s) => ({
              id: s.id,
              title: s.title,
              roleName: s.roleName,
              joinMode: s.joinMode,
              minRankPriority: s.minRankPriority,
              holderId: s.holder?.id ?? null,
              holderName: s.holder?.nickname ?? s.holder?.discordUsername ?? null,
            })),
            bans: t.bans.map((b) => ({
              userId: b.user.id,
              userName: b.user.nickname ?? b.user.discordUsername ?? b.user.id,
              reason: b.reason,
              bannedByName: b.bannedBy.nickname ?? b.bannedBy.discordUsername ?? "—",
              createdAt: b.createdAt.toISOString(),
            })),
          }))}
          applications={applications.map((a) => ({
            id: a.id,
            applicantId: a.applicant.id,
            applicantName: a.applicant.nickname ?? a.applicant.discordUsername ?? a.applicant.id,
            slotTitle: a.slot.title,
            teamId: a.slot.team.id,
            teamName: a.slot.team.name,
            message: a.message,
            createdAt: a.createdAt,
          }))}
        />
      </div>
    </>
  );
}
