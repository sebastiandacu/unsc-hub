import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export default async function TeamsListPage() {
  await requireUser();
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: { slots: { select: { id: true, holderId: true } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="// Order of Battle"
        title="Teams"
        description="Unidades operativas. Entra en un equipo para ver slots, miembros y aplicar."
      />
      <div className="p-8">
        {teams.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-muted)] font-mono">
            — Sin equipos. Un admin puede crearlos en /admin/teams —
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 reveal-stagger">
            {teams.map((t) => {
              const filled = t.slots.filter((s) => s.holderId).length;
              const pct = t.slots.length === 0 ? 0 : Math.round((filled / t.slots.length) * 100);
              return (
                <Link
                  key={t.id}
                  href={`/roster/teams/${t.id}`}
                  className="panel panel-bracket p-5 hover:border-[var(--color-accent)] transition-all group relative overflow-hidden isolate"
                >
                  {t.logoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={t.logoUrl}
                      alt=""
                      aria-hidden
                      className="pointer-events-none select-none absolute inset-0 w-full h-full object-contain object-center brightness-[0.35] group-hover:brightness-[0.5] group-hover:scale-105 transition-all duration-700 -z-10"
                    />
                  )}
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}80` }} />
                      {t.callsign && <span className="label-mono-accent">{t.callsign}</span>}
                    </div>
                    <span className="label-mono text-[8.5px] text-[var(--color-border-2)]">UNIT</span>
                  </div>
                  <h2 className="display-md mt-4 group-hover:text-[var(--color-accent)] transition-colors relative" style={{ fontFamily: "var(--font-display)" }}>{t.name}</h2>
                  {t.description && <p className="text-sm text-[var(--color-text-dim)] mt-3 line-clamp-2 leading-relaxed relative">{t.description}</p>}
                  <div className="mt-5 space-y-1.5 relative">
                    <div className="label-mono flex justify-between">
                      <span>{filled}/{t.slots.length} slots</span>
                      <span className="text-[var(--color-accent)]">{pct}%</span>
                    </div>
                    <div className="h-1 bg-[var(--color-border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-accent)] transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
