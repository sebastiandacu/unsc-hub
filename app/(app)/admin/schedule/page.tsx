import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { ScheduleAdmin } from "./ScheduleAdmin";

export default async function AdminSchedulePage() {
  await requireAdmin();
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { rsvps: true } } },
  });
  return (
    <>
      <PageHeader
        eyebrow="// Admin"
        title="Schedule"
        description="Crea operaciones con briefings completos. Los operativos hacen RSVP desde /roster/schedule."
      />
      <div className="p-8">
        <ScheduleAdmin
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
          }))}
        />
      </div>
    </>
  );
}
