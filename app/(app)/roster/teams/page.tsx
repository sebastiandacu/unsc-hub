import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export default async function TeamsListPage() {
  await requireUser();
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      slots: {
        select: { id: true, holderId: true, holder: { select: { nickname: true, discordUsername: true } } },
      },
    },
  });

  const totalOps = teams.reduce(
    (acc, t) => acc + t.slots.filter((s) => s.holderId).length,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="ESTRUCTURA"
        title="Equipos."
        description="Fireteams operativos. Cada equipo tiene líder, especialidad y slots de despliegue. Tocá una tarjeta para ver el roster completo."
        stamps={[
          { label: `▸ ${teams.length} ${teams.length === 1 ? "EQUIPO" : "EQUIPOS"}` },
          { label: `▸ ${totalOps} OPERATIVOS`, tone: "muted" },
        ]}
      />

      <div className="px-7 pb-7">
        {teams.length === 0 ? (
          <div className="panel-elevated panel-bracket p-12 text-center text-[var(--color-muted)] font-mono">
            — Sin equipos. Un admin puede crearlos en /admin/teams —
          </div>
        ) : (
          <div
            className="grid gap-4 reveal-stagger"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            {teams.map((t) => {
              const filled = t.slots.filter((s) => s.holderId).length;
              const pct = t.slots.length === 0 ? 0 : Math.round((filled / t.slots.length) * 100);
              const leader = t.slots.find((s) => s.holder)?.holder;
              const leaderName = leader?.nickname ?? leader?.discordUsername ?? "—";
              const initial = (t.callsign ?? t.name).trim()[0]?.toUpperCase() ?? "U";

              return (
                <Link
                  key={t.id}
                  href={`/roster/teams/${t.id}`}
                  className="panel-elevated panel-bracket relative overflow-hidden p-5 group hover:-translate-y-0.5 transition-transform duration-300"
                >
                  {/* Big watermark letter */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute select-none"
                    style={{
                      top: 0,
                      right: 0,
                      transform: "translate(20%, -10%)",
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: 180,
                      lineHeight: 0.9,
                      color: t.color,
                      opacity: 0.05,
                    }}
                  >
                    {initial}
                  </span>

                  {/* Logo behind text — toned way down */}
                  {t.logoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={t.logoUrl}
                      alt=""
                      aria-hidden
                      className="pointer-events-none select-none absolute inset-0 w-full h-full object-contain object-center brightness-[0.18] group-hover:brightness-[0.28] group-hover:scale-105 transition-all duration-700 -z-10"
                    />
                  )}

                  <div className="relative flex gap-2 mb-3.5 flex-wrap">
                    <span
                      className="stamp"
                      style={{
                        borderColor: t.color,
                        color: t.color,
                        background: "transparent",
                      }}
                    >
                      ▸ FIRETEAM
                    </span>
                    <span className="stamp stamp-muted">{filled}/{t.slots.length} OPS</span>
                  </div>

                  <div
                    className="relative uppercase"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 38,
                      lineHeight: 0.9,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {t.name}
                  </div>
                  {t.callsign && (
                    <div className="label-mono-accent mt-2 relative">
                      [{t.callsign}]
                    </div>
                  )}

                  {t.description && (
                    <div
                      className="mt-3 italic relative"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--color-text-dim)",
                        letterSpacing: "0.04em",
                        lineHeight: 1.5,
                      }}
                    >
                      &quot;{t.description.split("\n")[0].slice(0, 90)}{t.description.length > 90 ? "..." : ""}&quot;
                    </div>
                  )}

                  <hr className="hr my-4 relative" />

                  <div className="grid grid-cols-2 gap-3 relative">
                    <div>
                      <div className="label-mono">LÍDER</div>
                      <div
                        className="mt-0.5 truncate"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "var(--color-accent)",
                        }}
                      >
                        &quot;{leaderName.toUpperCase()}&quot;
                      </div>
                    </div>
                    <div>
                      <div className="label-mono">CUPO</div>
                      <div
                        className="mt-0.5"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 22,
                          color: "var(--color-text)",
                        }}
                      >
                        {pct}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-1 bg-[var(--color-border)] overflow-hidden relative">
                    <div
                      className="h-full bg-[var(--color-accent)] transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="btn mt-4 w-full justify-center relative">
                    VER ROSTER →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
