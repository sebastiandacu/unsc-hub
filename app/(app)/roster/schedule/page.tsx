import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
  const events = await prisma.event.findMany({
    where: { startsAt: { gte: sixtyDaysAgo } },
    orderBy: { startsAt: "asc" },
    include: {
      rsvps: {
        include: { user: { select: { id: true, nickname: true, discordUsername: true } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="// Operations Calendar"
        title="Schedule"
        description="Operaciones próximas, briefings y entrenamientos. Click sobre un evento para el briefing completo."
      />
      <div className="p-8">
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
