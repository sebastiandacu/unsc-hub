import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/PageHeader";
import { resolveRank } from "@/lib/rank";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const user = await requireUser();
  const rank = await resolveRank(user.id);

  const [pinned, mySlots, upcoming, unreadCount, activity] = await Promise.all([
    prisma.bulletinPost.findMany({
      where: { pinned: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.teamSlot.findMany({
      where: { holderId: user.id },
      include: { team: { select: { id: true, name: true, callsign: true, color: true } } },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, title: true, startsAt: true, location: true },
    }),
    prisma.bulletinPost.count({
      where: { reads: { none: { userId: user.id } } },
    }),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "bulletin.create",
            "wall.pinThread",
            "team.create",
            "event.create",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { id: true, nickname: true, discordUsername: true } } },
    }),
  ]);

  const display = user.nickname || user.discordUsername || "Operativo";

  return (
    <>
      <PageHeader
        eyebrow={`// Bienvenido, ${display}`}
        title="Dashboard"
        description="Bulletins fijados, tus equipos y operaciones próximas."
      />

      <div className="p-8 space-y-6 reveal">
        {/* === Stat row === */}
        <div className="grid lg:grid-cols-3 gap-5 reveal-stagger">
          <Card label="Standing" value={rank.label} sub={`Fuente: ${rank.source}`} />
          <Card label="Permission" value={user.permission} sub="Rol en el hub" />
          <Card
            label="Bulletins sin leer"
            value={String(unreadCount)}
            sub={unreadCount > 0 ? "Ponte al día." : "Todo limpio."}
            urgent={unreadCount > 0}
          />
        </div>

        {/* === Two-column row === */}
        <div className="grid lg:grid-cols-2 gap-5 reveal-stagger">
          <section className="panel panel-bracket p-5">
            <SectionTitle code="01" label="Pinned Bulletins" />
            {pinned.length === 0 ? (
              <Empty>Nada fijado por ahora.</Empty>
            ) : (
              <ul className="space-y-2 mt-4">
                {pinned.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/bulletin/${p.id}`}
                      className="block border border-[var(--color-border)] px-3.5 py-2.5 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all group"
                    >
                      <div className="font-mono text-sm truncate group-hover:text-[var(--color-accent)] transition-colors">
                        {p.title}
                      </div>
                      <div className="label-mono mt-1 text-[9.5px]">
                        {new Date(p.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel panel-bracket p-5">
            <SectionTitle code="02" label="My Teams" />
            {mySlots.length === 0 ? (
              <Empty>
                No estás en ningún equipo aún.{" "}
                <Link href="/roster/teams" className="text-[var(--color-accent)] hover:underline">
                  Ver Teams →
                </Link>
              </Empty>
            ) : (
              <ul className="space-y-2 mt-4">
                {mySlots.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/roster/teams/${s.team.id}`}
                      className="block border border-[var(--color-border)] px-3.5 py-2.5 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: s.team.color }}
                        />
                        <span className="font-mono text-sm truncate group-hover:text-[var(--color-accent)] transition-colors">
                          {s.team.name}
                          {s.team.callsign && (
                            <span className="label-mono ml-2 text-[9.5px]">
                              {s.team.callsign}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="label-mono mt-1 text-[9.5px]">{s.title}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* === Activity feed === */}
        <section className="panel panel-bracket p-5">
          <SectionTitle code="03" label="Activity Feed" />
          {activity.length === 0 ? (
            <Empty>Sin actividad reciente.</Empty>
          ) : (
            <ul className="space-y-1.5 mt-4">
              {activity.map((a) => {
                const actor = a.actor.nickname ?? a.actor.discordUsername ?? "Operativo";
                const verb = ACTION_VERB[a.action] ?? a.action;
                const payload = a.payloadJson as { name?: string } | null;
                const detail = payload?.name ? ` · ${payload.name}` : "";
                return (
                  <li
                    key={a.id}
                    className="flex items-baseline gap-3 text-xs font-mono border-l-2 border-[var(--color-border)] pl-3 py-1 hover:border-[var(--color-accent)] transition-colors"
                  >
                    <span className="label-mono text-[var(--color-muted)] shrink-0 w-20">
                      {timeAgo(a.createdAt)}
                    </span>
                    <span className="text-[var(--color-accent)] shrink-0">
                      <Link href={`/roster/${a.actor.id}`} className="hover:underline">{actor}</Link>
                    </span>
                    <span className="text-[var(--color-muted)] truncate">
                      {verb}{detail}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* === Upcoming === */}
        <section className="panel panel-bracket p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle code="04" label="Upcoming Operations" />
            <Link
              href="/roster/schedule"
              className="label-mono hover:text-[var(--color-accent)] transition-colors"
            >
              Abrir calendario →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty>Sin operaciones en el calendario.</Empty>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-4 border border-[var(--color-border)] px-3.5 py-2.5 hover:border-[var(--color-accent)] transition-colors group"
                >
                  <span className="label-mono shrink-0 w-40 text-[var(--color-accent)]">
                    {new Date(e.startsAt).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-mono text-sm flex-1 truncate group-hover:text-[var(--color-accent)] transition-colors">
                    {e.title}
                  </span>
                  {e.location && <span className="label-mono">{e.location}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Card({
  label,
  value,
  sub,
  urgent,
}: {
  label: string;
  value: string;
  sub?: string;
  urgent?: boolean;
}) {
  return (
    <div className="panel panel-bracket p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className="label-mono">{label}</div>
        {urgent && <span className="size-1.5 bg-[var(--color-danger)] animate-pulse" />}
      </div>
      <div className="metric mt-4 transition-transform group-hover:translate-x-1">{value}</div>
      {sub && <div className="text-xs text-[var(--color-muted)] mt-2 font-mono">{sub}</div>}
      {/* Decorative */}
      <span className="absolute right-3 top-3 label-mono text-[8px] text-[var(--color-border-2)]">
        REC.{label.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}

function SectionTitle({ code, label }: { code: string; label: string }) {
  return (
    <h2 className="flex items-center gap-3 font-mono uppercase text-sm tracking-[0.18em]">
      <span className="text-[10px] text-[var(--color-accent)]">{code}</span>
      <span className="text-[var(--color-text)]">{label}</span>
    </h2>
  );
}

const ACTION_VERB: Record<string, string> = {
  "bulletin.create": "publicó un bulletin",
  "wall.pinThread": "fijó un hilo",
  "team.create": "creó un equipo",
  "event.create": "creó una operación",
};

function timeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "ahora";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-[var(--color-muted)] mt-3 border border-dashed border-[var(--color-border)] px-3 py-4 text-center font-mono">
      {children}
    </div>
  );
}
