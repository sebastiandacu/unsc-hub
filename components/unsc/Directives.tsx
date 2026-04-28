/**
 * UNSC Directives — your todo-style action items derived from app state
 * (unread bulletins, pending RSVPs, missing profile fields, etc).
 */
import Link from "next/link";

type Directive = {
  code: string;          // "D-01"
  title: string;
  urgency: "HOY" | "24H" | "48H" | "ESTE_MES";
  href: string;
};

export function Directives({ items }: { items: Directive[] }) {
  if (items.length === 0) return null;

  return (
    <div className="panel-elevated reticle relative p-4">
      <span className="rt-bl" />
      <span className="rt-br" />

      <div className="sect-h" style={{ marginBottom: 12 }}>
        <div className="sect-title">
          <span className="num">// 06</span>
          <h2>Tus Directivas</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {items.length} {items.length === 1 ? "PENDIENTE" : "PENDIENTES"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((d) => {
          const stamp =
            d.urgency === "HOY"
              ? "stamp-red"
              : d.urgency === "24H"
                ? "stamp-amber"
                : "";
          const urgencyLabel = d.urgency === "ESTE_MES" ? "ESTE MES" : d.urgency;
          return (
            <Link
              key={d.code}
              href={d.href}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2.5 border border-[var(--color-border)] bg-[var(--color-base-2)] hover:border-[var(--color-accent)] hover:bg-[var(--color-panel-2)] transition-all group"
            >
              <div>
                <div className="font-mono text-[9px] tracking-[0.2em] text-[var(--color-muted)]">
                  {d.code}
                </div>
                <div className="text-[13px] text-[var(--color-text)] mt-0.5 group-hover:text-[var(--color-accent)] transition-colors">
                  {d.title}
                </div>
              </div>
              <span className={`stamp ${stamp}`}>{urgencyLabel}</span>
              <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                ›
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
