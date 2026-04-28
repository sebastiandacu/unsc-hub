import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { unit } from "@/config/unit";

type CatRow = {
  id: string;
  slug: string;
  name: string;
  color: string;
  description: string | null;
};

function relativeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "ahora";
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `hace ${Math.floor(sec / 86400)}d`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default async function WallPage() {
  // Categories — fall back to config defaults so the page never breaks during seeding.
  let categories: CatRow[] = [];
  try {
    categories = await prisma.wallCategory.findMany({ orderBy: { sortOrder: "asc" } });
  } catch {
    categories = unit.defaultWallCategories.map((c, i) => ({
      id: `fallback-${i}`,
      ...c,
      description: c.description ?? null,
    }));
  }
  if (categories.length === 0) {
    categories = unit.defaultWallCategories.map((c, i) => ({
      id: `fallback-${i}`,
      ...c,
      description: c.description ?? null,
    }));
  }

  // Per-category counts + recent threads + total threads.
  const realCatIds = categories.filter((c) => !c.id.startsWith("fallback-")).map((c) => c.id);

  const [countsByCat, recent] = await Promise.all([
    realCatIds.length > 0
      ? prisma.wallThread.groupBy({
          by: ["categoryId"],
          where: { categoryId: { in: realCatIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ categoryId: string; _count: { _all: number } }>),
    realCatIds.length > 0
      ? prisma.wallThread.findMany({
          where: { categoryId: { in: realCatIds } },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            author: { select: { id: true, nickname: true, discordUsername: true } },
            category: { select: { slug: true, name: true, color: true } },
            _count: { select: { replies: true, reactions: true } },
          },
        })
      : Promise.resolve([] as never[]),
  ]);

  const countMap = new Map(countsByCat.map((c) => [c.categoryId, c._count._all]));
  const totalThreads = recent.length === 0 ? 0 : countsByCat.reduce((acc, c) => acc + c._count._all, 0);

  return (
    <>
      <PageHeader
        eyebrow="DISCUSIÓN"
        title="Muro."
        description="Hilos en y fuera de personaje. Marcá Actionable solo si requiere respuesta operativa."
        stamps={[
          { label: `▸ ${categories.length} CANALES` },
          ...(totalThreads > 0
            ? [{ label: `▸ ${totalThreads} ${totalThreads === 1 ? "HILO" : "HILOS"}`, tone: "muted" as const }]
            : []),
        ]}
      />

      <div className="px-7 pb-7 space-y-6">
        {/* === Category cards (handoff style: count + dot top, name + VER HILOS) === */}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {categories.map((c) => {
            const count = countMap.get(c.id) ?? 0;
            return (
              <Link
                key={c.slug}
                href={`/wall/${c.slug}`}
                className="panel-elevated panel-bracket p-4 group hover:-translate-y-0.5 transition-transform duration-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="size-2 shrink-0" style={{ background: c.color }} />
                  <span
                    className="leading-none"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 28,
                      color: c.color,
                    }}
                  >
                    {count}
                  </span>
                </div>
                <div
                  className="label-mono"
                  style={{ color: "var(--color-text)", fontSize: 10 }}
                >
                  {c.name}
                </div>
                <div className="label-mono mt-1 group-hover:text-[var(--color-accent)] transition-colors">
                  VER HILOS →
                </div>
              </Link>
            );
          })}
        </div>

        {/* === Recent threads list === */}
        <div className="panel-elevated panel-bracket">
          <div className="px-4 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
            <span className="label-mono-accent">// HILOS RECIENTES</span>
            <span className="label-mono">ORDENAR: ACTIVIDAD ↓</span>
          </div>

          {recent.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-[var(--color-muted)]">
              — Sin hilos todavía. Sé el primero. —
            </div>
          ) : (
            <div>
              {recent.map((t) => (
                <Link
                  key={t.id}
                  href={`/wall/${t.category.slug}/${t.id}`}
                  className="grid gap-4 px-4 py-3.5 border-b border-[var(--color-border)] last:border-b-0 items-center hover:bg-[var(--color-panel-2)] transition-colors group"
                  style={{ gridTemplateColumns: "auto 1fr auto auto" }}
                >
                  <span
                    className="size-2 shrink-0"
                    style={{ background: t.category.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                      {t.title}
                    </div>
                    <div className="label-mono mt-1 normal-case tracking-[0.18em]">
                      {t.category.name.toUpperCase()} · {(t.author.nickname ?? t.author.discordUsername ?? "OPERATIVO").toUpperCase()} · {relativeAgo(t.updatedAt)}
                    </div>
                  </div>
                  <span
                    className="label-mono shrink-0"
                    style={{ color: "var(--color-text-dim)", fontSize: 10 }}
                  >
                    ↑ {t._count.reactions}
                  </span>
                  <span
                    className="label-mono shrink-0"
                    style={{ color: "var(--color-accent)", fontSize: 10 }}
                  >
                    💬 {t._count.replies}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
