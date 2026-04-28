import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getRankLabelMap, rankLabel } from "@/lib/rank-labels";
import { SlotRow } from "./SlotRow";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: { sortOrder: "asc" },
        include: {
          holder: { select: { id: true, nickname: true, discordUsername: true, avatarUrl: true } },
          applications: {
            where: { status: "PENDING" },
            select: { id: true, applicantId: true },
          },
        },
      },
    },
  });
  if (!team) notFound();

  const rankMap = await getRankLabelMap();
  const rankObj = Object.fromEntries(rankMap);
  const teamMinLabel = rankLabel(team.minRankPriority, rankMap);

  return (
    <>
      <PageHeader
        eyebrow={team.callsign ? `// ${team.callsign}` : "// Equipo"}
        title={team.name}
        description={team.description ?? undefined}
      />
      <div className="p-8 space-y-3">
        {team.logoUrl && (
          <div className="panel p-6 flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={team.logoUrl}
              alt={team.name}
              className="size-28 object-contain border border-[var(--color-border)] bg-[var(--color-base)] p-2"
            />
            <div className="min-w-0">
              <div className="label-mono">Insignia</div>
              <div className="font-mono text-lg mt-1">{team.callsign ?? team.name}</div>
              <div className="size-2.5 rounded-full mt-2" style={{ background: team.color, boxShadow: `0 0 8px ${team.color}80` }} />
            </div>
          </div>
        )}
        <div className="panel p-4 flex items-center gap-4 text-xs font-mono">
          <span className="label-mono">Membresía múltiple:</span>
          <span>{team.allowsMultiMembership ? "Permitida" : "Un slot por operativo"}</span>
          {team.minRankPriority !== null && (
            <>
              <span className="label-mono ml-4">Rango mínimo del equipo:</span>
              <span className="text-[var(--color-accent)]">{teamMinLabel}</span>
            </>
          )}
        </div>

        {team.slots.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-muted)]">
            Sin slots configurados para este equipo.
          </div>
        ) : (
          team.slots.map((s) => {
            const myPending = s.applications.some((a) => a.applicantId === me.id);
            return (
              <SlotRow
                key={s.id}
                slot={{
                  id: s.id,
                  title: s.title,
                  roleName: s.roleName,
                  joinMode: s.joinMode,
                  minRankPriority: s.minRankPriority,
                  holder: s.holder,
                }}
                team={{ id: team.id, allowsMultiMembership: team.allowsMultiMembership }}
                isMine={s.holderId === me.id}
                myPending={myPending}
                rankLabels={rankObj}
              />
            );
          })
        )}

        <div className="panel p-4 mt-8">
          <Link href="/roster/teams" className="label-mono hover:text-[var(--color-accent)]">← Todos los equipos</Link>
        </div>
      </div>
    </>
  );
}
