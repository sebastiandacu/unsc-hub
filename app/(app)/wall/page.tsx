import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { unit } from "@/config/unit";

export default async function WallPage() {
  // If DB is unreachable / unmigrated, fall back to the configured defaults so the page still renders.
  let categories: Array<{ slug: string; name: string; color: string; description: string | null }> = [];
  try {
    categories = await prisma.wallCategory.findMany({ orderBy: { sortOrder: "asc" } });
  } catch {
    categories = unit.defaultWallCategories.map((c) => ({ ...c, description: c.description ?? null }));
  }
  if (categories.length === 0) {
    categories = unit.defaultWallCategories.map((c) => ({ ...c, description: c.description ?? null }));
  }

  return (
    <>
      <PageHeader
        eyebrow="// Forum"
        title="The Wall"
        description="Hilos de discusión agrupados por categoría. Elige una para empezar."
      />
      <div className="p-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 reveal-stagger">
        {categories.map((c, i) => (
          <Link
            key={c.slug}
            href={`/wall/${c.slug}`}
            className="panel panel-bracket p-5 hover:border-[var(--color-accent)] transition-all group relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: `linear-gradient(135deg, ${c.color}10, transparent 60%)` }}
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 12px ${c.color}80` }} />
                  <span className="label-mono">{c.slug}</span>
                </div>
                <span className="label-mono text-[8.5px] text-[var(--color-border-2)]">CH.{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h2 className="display-md mt-4 group-hover:text-[var(--color-accent)] transition-colors" style={{ fontFamily: "var(--font-display)" }}>{c.name}</h2>
              {c.description && <p className="text-sm text-[var(--color-text-dim)] mt-3 leading-relaxed">{c.description}</p>}
              <div className="label-mono mt-4 flex items-center gap-2 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                Ver hilos <span>→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
