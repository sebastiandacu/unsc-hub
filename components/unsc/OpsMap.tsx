/**
 * UNSC Tactical Map — abstract continents + radar sweep + animated ping markers.
 * Pure presentation; pin coordinates derived from event IDs server-side.
 */
type Pin = {
  x: number; // 0-100
  y: number; // 0-100
  id: string;
  label: string;
  color?: "" | "amber" | "red";
};

export function OpsMap({ pins }: { pins: Pin[] }) {
  return (
    <div
      className="panel-elevated reticle ops-map relative h-[380px] overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(77,208,255,0.04) 0%, transparent 70%), var(--color-base-2)",
      }}
    >
      <span className="rt-bl" />
      <span className="rt-br" />

      {/* Continents — abstract polygons */}
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <path
          d="M5,18 L18,12 L26,18 L32,14 L38,22 L30,30 L20,32 L12,28 L8,24 Z"
          fill="rgba(77,208,255,0.04)"
          stroke="rgba(77,208,255,0.18)"
          strokeWidth="0.15"
        />
        <path
          d="M44,8 L62,6 L72,12 L78,22 L70,28 L56,26 L48,18 Z"
          fill="rgba(77,208,255,0.04)"
          stroke="rgba(77,208,255,0.18)"
          strokeWidth="0.15"
        />
        <path
          d="M58,32 L78,34 L88,40 L92,52 L80,56 L66,52 L60,42 Z"
          fill="rgba(77,208,255,0.04)"
          stroke="rgba(77,208,255,0.18)"
          strokeWidth="0.15"
        />
        <path
          d="M14,40 L30,38 L36,46 L32,54 L20,56 L10,50 Z"
          fill="rgba(77,208,255,0.04)"
          stroke="rgba(77,208,255,0.18)"
          strokeWidth="0.15"
        />
      </svg>

      {/* Cobalt grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(77,208,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(77,208,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Radar */}
      <div className="absolute left-1/2 top-1/2 w-[600px] h-[600px] -ml-[300px] -mt-[300px] rounded-full border border-[rgba(77,208,255,0.12)] pointer-events-none">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(77,208,255,0) 0deg, rgba(77,208,255,0) 320deg, rgba(77,208,255,0.18) 355deg, rgba(77,208,255,0.4) 360deg)",
            animation: "radar-sweep 4s linear infinite",
          }}
        />
        <div
          className="absolute rounded-full border border-[rgba(77,208,255,0.10)]"
          style={{ inset: "25%" }}
        />
        <div
          className="absolute rounded-full border border-[rgba(77,208,255,0.10)]"
          style={{ inset: "10%" }}
        />
      </div>

      {/* Pins */}
      {pins.map((p, i) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-[18px] h-[18px]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
        >
          <div
            className="absolute inset-0 rounded-full border"
            style={{
              borderColor:
                p.color === "amber"
                  ? "var(--color-amber)"
                  : p.color === "red"
                    ? "var(--color-danger)"
                    : "var(--color-accent)",
              animation: `pin-ping 2.4s ease-out ${i * 0.3}s infinite`,
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 6,
              height: 6,
              background:
                p.color === "amber"
                  ? "var(--color-amber)"
                  : p.color === "red"
                    ? "var(--color-danger)"
                    : "var(--color-accent)",
              boxShadow: `0 0 8px ${p.color === "amber" ? "var(--color-amber)" : p.color === "red" ? "var(--color-danger)" : "var(--color-accent)"}`,
            }}
          />
          <div
            className="absolute font-mono text-[9px] uppercase tracking-[0.16em] whitespace-nowrap text-[var(--color-text-dim)]"
            style={{ transform: "translate(12px, -8px)" }}
          >
            <span style={{ color: "var(--color-accent)" }}>{p.id}</span>
            <br />
            <span style={{ opacity: 0.7 }}>{p.label}</span>
          </div>
        </div>
      ))}

      {/* Corner labels */}
      <div className="absolute top-3 left-4 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        // Mapa Táctico · Tiempo Real
      </div>
      <div className="absolute top-3 right-4 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {pins.length} pings · zona azul
      </div>
      <div className="absolute bottom-3 left-4 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        LAT 34.05°N / LON 118.24°W
      </div>
      <div
        className="absolute bottom-3 right-4 font-mono text-[9px] uppercase tracking-[0.18em]"
        style={{ color: "var(--color-accent)" }}
      >
        ESCALA 1:240k
      </div>

      <style>{`
        @keyframes radar-sweep { to { transform: rotate(360deg); } }
        @keyframes pin-ping {
          0%   { transform: scale(0.4); opacity: 1; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
