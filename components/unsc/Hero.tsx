/**
 * UNSC Dashboard Hero — left side of the top row.
 * Big "BIENVENIDO, OPERADOR" headline + stats grid. Wired to real numbers.
 */
type HeroProps = {
  display: string;
  stats: {
    onlineNow: number;
    rosterTotal: number;
    activeOps: number;
    nextOpRelative: string;
    nextOpName: string | null;
    bulletinUnread: number;
    bulletinTotal: number;
  };
  alerts: { label: string; tone?: "default" | "amber" | "muted" }[];
  caretLine: string;
};

export function Hero({ display, stats, alerts, caretLine }: HeroProps) {
  return (
    <div className="panel-elevated reticle hero-main scan-sweep relative p-7 min-h-[320px] overflow-hidden">
      <span className="rt-bl" />
      <span className="rt-br" />

      <div className="flex flex-wrap gap-3 items-center">
        {alerts.map((a, i) => (
          <span
            key={i}
            className={`stamp ${a.tone === "amber" ? "stamp-amber" : a.tone === "muted" ? "stamp-muted" : ""}`}
          >
            {a.label}
          </span>
        ))}
      </div>

      <h1
        className="display-xl mt-3 mb-1"
        style={{ color: "var(--color-text)" }}
      >
        BIENVENIDO,
        <br />
        <span style={{ color: "var(--color-accent)" }}>{display.toUpperCase()}.</span>
      </h1>

      <div className="hero-sub caret font-mono text-xs leading-relaxed text-[var(--color-text-dim)] max-w-[60ch] tracking-[0.06em]">
        {caretLine}
      </div>

      <div className="hero-grid grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--color-border)] mt-6 border border-[var(--color-border)]">
        <Cell
          label="Operativos en línea"
          value={String(stats.onlineNow).padStart(2, "0")}
          sub={`/${String(stats.rosterTotal).padStart(2, "0")} en roster`}
          accentValue
        />
        <Cell
          label="Operaciones activas"
          value={String(stats.activeOps).padStart(2, "0")}
          sub={stats.activeOps === 0 ? "Sin ops en curso" : "En ejecución"}
          accentValue
        />
        <Cell
          label="Próximo despliegue"
          value={stats.nextOpRelative}
          sub={stats.nextOpName ?? "Sin programar"}
          accentValue
        />
        <Cell
          label="Boletines"
          value={String(stats.bulletinTotal).padStart(2, "0")}
          sub={
            stats.bulletinUnread > 0
              ? `${stats.bulletinUnread} sin leer`
              : "Al día"
          }
          accentValue
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  accentValue,
}: {
  label: string;
  value: string;
  sub: string;
  accentValue?: boolean;
}) {
  return (
    <div className="bg-[var(--color-panel)] p-4">
      <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-[var(--color-muted)]">
        {label}
      </div>
      <div
        className="mt-1 font-semibold text-2xl tracking-[-0.01em]"
        style={{
          fontFamily: "var(--font-display)",
          color: accentValue ? "var(--color-accent)" : "var(--color-text)",
        }}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] text-[var(--color-text-dim)] mt-0.5">
        {sub}
      </div>
    </div>
  );
}
