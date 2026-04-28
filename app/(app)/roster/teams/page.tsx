import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

type SlotMini = {
  id: string;
  holderId: string | null;
  holder: { nickname: string | null; discordUsername: string | null } | null;
};
type TeamRow = {
  id: string;
  name: string;
  callsign: string | null;
  color: string;
  logoUrl: string | null;
  description: string | null;
  categoryId: string | null;
  slots: SlotMini[];
};
type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  logoUrl: string | null;
  sortOrder: number;
};

export default async function TeamsListPage() {
  await requireUser();

  const [teams, categories] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ createdAt: "asc" }],
      include: {
        slots: {
          select: {
            id: true,
            holderId: true,
            holder: { select: { nickname: true, discordUsername: true } },
          },
        },
      },
    }),
    prisma.teamCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const totalOps = teams.reduce(
    (acc, t) => acc + t.slots.filter((s) => s.holderId).length,
    0,
  );

  // Bucket teams by categoryId. Anything orphan goes into a synthetic "Sin categoría".
  const byCat = new Map<string, TeamRow[]>();
  for (const t of teams) {
    const key = t.categoryId ?? "__uncategorized__";
    const arr = byCat.get(key) ?? [];
    arr.push(t as TeamRow);
    byCat.set(key, arr);
  }

  const groups: { category: CategoryRow | null; teams: TeamRow[] }[] = [];
  for (const c of categories) {
    const teamsInCat = byCat.get(c.id) ?? [];
    if (teamsInCat.length > 0) groups.push({ category: c, teams: teamsInCat });
  }
  const orphans = byCat.get("__uncategorized__") ?? [];
  if (orphans.length > 0) groups.push({ category: null, teams: orphans });

  return (
    <>
      <PageHeader
        eyebrow="ESTRUCTURA"
        title="Equipos."
        description="Fireteams operativos agrupados por categoría. Tocá una tarjeta para ver el roster completo."
        stamps={[
          { label: `▸ ${categories.length} ${categories.length === 1 ? "CAT." : "CATS."}` },
          { label: `▸ ${teams.length} ${teams.length === 1 ? "EQUIPO" : "EQUIPOS"}` },
          { label: `▸ ${totalOps} OPERATIVOS`, tone: "muted" },
        ]}
      />

      <div className="px-7 pb-7 space-y-9">
        {teams.length === 0 ? (
          <div className="panel-elevated panel-bracket p-12 text-center text-[var(--color-muted)] font-mono">
            — Sin equipos. Un admin puede crearlos en /admin/teams —
          </div>
        ) : (
          groups.map(({ category, teams: ts }, i) => (
            <CategorySection key={category?.id ?? "uncat"} category={category} teams={ts} index={i} />
          ))
        )}
      </div>
    </>
  );
}

function CategorySection({
  category,
  teams,
  index,
}: {
  category: CategoryRow | null;
  teams: TeamRow[];
  index: number;
}) {
  const color = category?.color ?? "var(--color-muted)";
  const name = category?.name ?? "Sin categoría";
  const description = category?.description ?? null;

  return (
    <section className="space-y-4">
      {/* HEADER: [LOGO] CATEGORY NAME — centered horizontally with the text. */}
      <div className="flex items-center gap-4">
        {category?.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={category.logoUrl}
            alt=""
            className="size-12 object-contain shrink-0"
            style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        ) : (
          <div
            className="size-12 grid place-items-center border shrink-0 font-mono text-[11px]"
            style={{ borderColor: color, color }}
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="font-mono text-[10px] tracking-[0.22em] uppercase"
              style={{ color }}
            >
              // {String(index + 1).padStart(2, "0")}
            </span>
            <h2
              className="m-0 uppercase truncate"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "clamp(1.4rem, 3vw, 2.1rem)",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              {name}
            </h2>
            <span className="stamp stamp-muted">
              {teams.length} {teams.length === 1 ? "EQUIPO" : "EQUIPOS"}
            </span>
          </div>
          {description && (
            <p
              className="mt-1.5 text-[var(--color-text-dim)] truncate"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Accent rule colored to the category */}
      <div
        className="h-px"
        style={{
          background: `linear-gradient(90deg, ${color}66, transparent 80%)`,
        }}
      />

      <div
        className="grid gap-4 reveal-stagger"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}
      >
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} />
        ))}
      </div>
    </section>
  );
}

function TeamCard({ team: t }: { team: TeamRow }) {
  const filled = t.slots.filter((s) => s.holderId).length;
  const pct = t.slots.length === 0 ? 0 : Math.round((filled / t.slots.length) * 100);
  const leader = t.slots.find((s) => s.holder)?.holder;
  const leaderName = leader?.nickname ?? leader?.discordUsername ?? "—";
  const initial = (t.callsign ?? t.name).trim()[0]?.toUpperCase() ?? "U";

  return (
    <Link
      href={`/roster/teams/${t.id}`}
      className="panel-elevated panel-bracket relative overflow-hidden p-5 group hover:-translate-y-0.5 transition-transform duration-300"
    >
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
          style={{ borderColor: t.color, color: t.color, background: "transparent" }}
        >
          ▸ FIRETEAM
        </span>
        <span className="stamp stamp-muted">
          {filled}/{t.slots.length} OPS
        </span>
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
        <div className="label-mono-accent mt-2 relative">[{t.callsign}]</div>
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

      <div className="btn mt-4 w-full justify-center relative">VER ROSTER →</div>
    </Link>
  );
}
