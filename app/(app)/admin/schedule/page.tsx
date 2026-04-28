import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { ScheduleAdmin } from "./ScheduleAdmin";

export default async function AdminSchedulePage() {
  await requireAdmin();
  const [events, teams] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { rsvps: true } },
        restrictedTeams: { select: { id: true } },
      },
    }),
    prisma.team.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        callsign: true,
        color: true,
        category: { select: { name: true } },
      },
    }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="ADMIN · OPERACIONES"
        title="Schedule."
        description="Creá operaciones con briefings completos. Los operativos hacen RSVP desde /roster/schedule."
      />
      <div className="px-7 pb-7">
        <ScheduleAdmin
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            callsign: t.callsign,
            color: t.color,
            categoryName: t.category?.name ?? null,
          }))}
          events={events.map((e) => ({
            id: e.id,
            title: e.title,
            startsAt: e.startsAt.toISOString(),
            endsAt: e.endsAt?.toISOString() ?? null,
            location: e.location,
            briefingJson: e.briefingJson as object,
            headerImageUrl: e.headerImageUrl,
            bannerImageUrl: e.bannerImageUrl,
            slidesEmbedUrl: e.slidesEmbedUrl,
            rsvpCount: e._count.rsvps,
            postToDiscord: e.postToDiscord,
            pingEveryone: e.pingEveryone,
            restrictedTeamIds: e.restrictedTeams.map((t) => t.id),
          }))}
        />
      </div>
    </>
  );
}
