import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { ScheduleClient } from "./ScheduleClient";
import { eventVisibilityWhere } from "@/lib/visibility";

export default async function SchedulePage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
  const visWhere = await eventVisibilityWhere(user.id, isAdmin);
  const events = await prisma.event.findMany({
    where: { AND: [{ startsAt: { gte: sixtyDaysAgo } }, visWhere] },
    orderBy: { startsAt: "asc" },
    include: {
      rsvps: {
        include: { user: { select: { id: true, nickname: true, discordUsername: true } } },
      },
      restrictedTeams: { select: { id: true, name: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="OPERACIONES"
        title="Calendario."
        description="Despliegues programados, briefings y entrenamientos. Confirmá asistencia con 24h de anticipación."
        stamps={[
          { label: `▸ ${events.filter((e) => new Date(e.startsAt) >= new Date()).length} OPS PRÓXIMAS`, tone: "amber" },
        ]}
      />
      <div className="px-7 pb-7">
        <ScheduleClient
          userId={user.id}
          isAdmin={isAdmin}
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
            outcome: e.outcome,
            aarJson: (e.aarJson ?? null) as object | null,
            aarPostedAt: e.aarPostedAt?.toISOString() ?? null,
            rsvps: e.rsvps.map((r) => ({
              userId: r.user.id,
              name: r.user.nickname ?? r.user.discordUsername ?? "Operative",
              status: r.status,
            })),
          }))}
        />
      </div>
    </>
  );
}
