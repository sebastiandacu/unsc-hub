/**
 * UNSC Bulletin Feed — numbered B-XXX rows with category dot + author + timestamp.
 */
import Link from "next/link";

type Item = {
  id: string;
  num: string;          // e.g. "B-014"
  category: string;     // "ACTIONABLE", "IN-CHARACTER", etc.
  categoryColor: "red" | "amber" | "green" | "cyan" | "muted";
  title: string;
  ts: string;           // pre-formatted ("hace 2h", "T-02:14:38")
  author: string;
  unread?: boolean;
};

export function BulletinFeed({
  items,
  unreadCount,
}: {
  items: Item[];
  unreadCount: number;
}) {
  return (
    <div className="panel-elevated reticle relative">
      <span className="rt-bl" />
      <span className="rt-br" />

      <div className="px-4 py-3.5 border-b border-[var(--color-border)]">
        <div className="sect-h" style={{ marginBottom: 0 }}>
          <div className="sect-title">
            <span className="num">// 01</span>
            <h2>Boletín</h2>
            {unreadCount > 0 && (
              <span className="stamp stamp-red ml-1.5">
                {unreadCount} {unreadCount === 1 ? "NUEVO" : "NUEVOS"}
              </span>
            )}
          </div>
          <Link
            href="/bulletin"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            Ver todo →
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center font-mono text-xs text-[var(--color-muted)] border-t border-dashed border-[var(--color-border)]">
          — Sin boletines fijados. —
        </div>
      ) : (
        <div>
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/bulletin/${it.id}`}
              className="grid grid-cols-[60px_1fr_auto] gap-3.5 px-4 py-3.5 border-b border-[var(--color-border)] last:border-b-0 items-center hover:bg-[var(--color-panel-2)] transition-colors group"
            >
              <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--color-muted)]">
                {it.num}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-muted)] mb-1 flex items-center gap-3">
                  <span
                    className={`dot dot-${it.categoryColor === "red" ? "red" : it.categoryColor === "amber" ? "amber" : it.categoryColor === "cyan" ? "cyan" : "pulse"}`}
                    style={{ width: 6, height: 6 }}
                  />
                  <span
                    style={{
                      color:
                        it.categoryColor === "red"
                          ? "var(--color-danger)"
                          : it.categoryColor === "amber"
                            ? "var(--color-amber)"
                            : it.categoryColor === "green"
                              ? "var(--color-success)"
                              : it.categoryColor === "cyan"
                                ? "var(--color-accent)"
                                : "var(--color-text-dim)",
                    }}
                  >
                    {it.category}
                  </span>
                  <span>·</span>
                  <span>{it.author}</span>
                </div>
                <div className="font-sans text-sm text-[var(--color-text)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                  {it.title}
                </div>
              </div>
              <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--color-muted)]">
                {it.ts}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
