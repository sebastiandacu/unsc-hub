/**
 * UNSC Schedule Feed — date block on left + title/details + "VER →" CTA.
 */
import Link from "next/link";

type Item = {
  id: string;
  d: string;          // "29"
  m: string;          // "ABR"
  title: string;
  details: string;    // "21:00 ZULU · Sala 2"
};

export function ScheduleFeed({ items, isAdmin }: { items: Item[]; isAdmin: boolean }) {
  return (
    <div className="panel-elevated reticle relative">
      <span className="rt-bl" />
      <span className="rt-br" />

      <div className="px-4 py-3.5 border-b border-[var(--color-border)]">
        <div className="sect-h" style={{ marginBottom: 0 }}>
          <div className="sect-title">
            <span className="num">// 04</span>
            <h2>Calendario</h2>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin/schedule"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                + Nuevo
              </Link>
            )}
            <Link
              href="/roster/schedule"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Ver todo →
            </Link>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center font-mono text-xs text-[var(--color-muted)] border-t border-dashed border-[var(--color-border)]">
          — Sin operaciones programadas. —
        </div>
      ) : (
        <div>
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/roster/schedule?event=${it.id}`}
              className="grid grid-cols-[auto_1fr_auto] gap-3.5 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 items-center hover:bg-[var(--color-panel-2)] transition-colors group"
            >
              <div
                className="text-center w-[50px]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <div className="text-[22px] leading-none font-bold" style={{ color: "var(--color-accent)" }}>
                  {it.d}
                </div>
                <div className="font-mono text-[9px] tracking-[0.2em] text-[var(--color-muted)] mt-0.5">
                  {it.m}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--color-text)] mb-0.5 truncate group-hover:text-[var(--color-accent)] transition-colors">
                  {it.title}
                </div>
                <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--color-muted)] truncate">
                  {it.details}
                </div>
              </div>
              <span className="btn !py-1 !px-2.5 text-[9px]">VER →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
