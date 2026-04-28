/**
 * UNSC Operator ID Card — right side of the top row.
 * Portrait box with scanline + identity + permission stamps.
 */
type OperatorProps = {
  idNumber: string;            // e.g. "09-447"
  rankShort: string;           // e.g. "SA."
  callsign: string;            // e.g. "SCARFACE"
  avatarUrl: string | null;
  permissions: { label: string; tone?: "default" | "amber" | "green" }[];
  accessLevel: number;         // 1-5
};

export function OperatorCard({
  idNumber,
  rankShort,
  callsign,
  avatarUrl,
  permissions,
  accessLevel,
}: OperatorProps) {
  return (
    <div className="panel-elevated reticle p-5 relative flex flex-col gap-3.5 overflow-hidden">
      <span className="rt-bl" />
      <span className="rt-br" />

      <div className="flex justify-between items-center">
        <div className="label-mono-accent">// Identificación</div>
        <span className="stamp" style={{ fontSize: 8.5 }}>
          NIVEL {accessLevel}
        </span>
      </div>

      <div className="op-portrait relative aspect-[1.05/1] border border-[var(--color-border-2)] grid place-items-center overflow-hidden bg-[var(--color-panel-2)]">
        {/* diagonal stripes background */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(135deg, rgba(77,208,255,0.04) 0, rgba(77,208,255,0.04) 6px, transparent 6px, transparent 12px), linear-gradient(180deg, var(--color-panel-2), var(--color-base-2))",
          }}
        />
        {/* scanline overlay */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(77,208,255,0) 49%, rgba(77,208,255,0.5) 50%, rgba(77,208,255,0) 51%, transparent 100%)",
            backgroundSize: "100% 8px",
            animation: "op-scan 4s linear infinite",
            mixBlendMode: "screen",
          }}
        />
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt={callsign}
            className="relative z-10 w-full h-full object-cover"
          />
        ) : (
          <span className="relative z-10 font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--color-muted)] bg-[var(--color-base-2)] px-3 py-1 border border-dashed border-[var(--color-border-2)]">
            ▸ Sin foto
          </span>
        )}
        <style>{`
          @keyframes op-scan {
            0% { background-position: 0 -100%; }
            100% { background-position: 0 200%; }
          }
        `}</style>
      </div>

      <div>
        <div className="font-mono text-[10px] text-[var(--color-muted)] tracking-[0.2em]">
          #{idNumber}
        </div>
        <div
          className="mt-0.5 font-bold text-2xl uppercase leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {rankShort}{" "}
          <span style={{ color: "var(--color-accent)" }}>
            &quot;{callsign.toUpperCase()}&quot;
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((p, i) => (
            <span
              key={i}
              className={`stamp ${p.tone === "amber" ? "stamp-amber" : p.tone === "green" ? "stamp-green" : ""}`}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
