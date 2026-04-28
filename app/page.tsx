import Link from "next/link";
import { unit } from "@/config/unit";

export default function LandingPage() {
  return (
    <main className="relative z-10 min-h-screen flex flex-col scan-sweep">
      {/* === Top stripe === */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)] reveal">
        <div className="flex items-center gap-3">
          <div className="size-11 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={unit.logo.seal} alt={unit.shortCode} className="size-full object-contain drop-shadow-[0_0_10px_rgba(212,167,44,0.4)]" />
          </div>
          <div>
            <div className="label-mono">{unit.parentAgency}</div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-accent)] mt-0.5">
              ★ DEPT. UNUSUAL INCIDENTS
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="label-mono hidden sm:inline">{unit.classification}</span>
          <Link href="/login" className="btn">
            Acceder →
          </Link>
        </div>
      </header>

      {/* === Hero === */}
      <section className="flex-1 grid lg:grid-cols-[1.25fr_1fr] gap-0 relative">
        <div className="flex flex-col justify-center px-8 lg:px-16 py-16 border-r border-[var(--color-border)] relative">
          <div className="reveal-stagger">
            <div className="flex items-center gap-3">
              <span className="stamp">CLEARANCE REQUIRED</span>
              <span className="label-mono">// FILE 47-A</span>
            </div>

            <h1
              className="display-xl mt-10"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {unit.name.split(" ").map((word, i) => (
                <span
                  key={i}
                  className="block"
                  style={
                    i === unit.name.split(" ").length - 1
                      ? { color: "var(--color-accent)" }
                      : undefined
                  }
                >
                  {word}
                </span>
              ))}
            </h1>

            <p className="mt-8 max-w-xl text-[var(--color-text-dim)] text-base lg:text-lg leading-relaxed text-pretty">
              <span className="text-[var(--color-accent)] font-mono uppercase tracking-widest text-sm">
                United Nations Space Command.
              </span>
              <br />
              Hub seguro de operaciones para personal autorizado del{" "}
              {unit.parentAgency} &mdash; {unit.name}. Boletines, intel,
              roster, calendario — todo en un solo terminal.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn btn-primary">
                Autenticar vía Discord →
              </Link>
              <Link href="/login" className="btn">
                Leer Standing Orders
              </Link>
            </div>

            <dl className="mt-16 grid grid-cols-3 gap-8 max-w-md">
              <Stat label="Operativos Activos" value="—" />
              <Stat label="Casos Abiertos" value="—" />
              <Stat label="Field Teams" value="—" />
            </dl>
          </div>
        </div>

        {/* Right transmission panel */}
        <aside className="relative bg-[var(--color-panel)]/80 flex flex-col justify-between px-8 lg:px-12 py-16 overflow-hidden">
          {/* radial glow */}
          <div
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              background:
                "radial-gradient(circle at 70% 30%, rgba(212,167,44,0.08), transparent 60%)",
            }}
          />
          {/* Seal watermark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={unit.logo.seal}
            alt=""
            aria-hidden
            className="absolute -right-24 -bottom-20 w-[520px] max-w-none opacity-[0.09] pointer-events-none select-none"
            style={{ filter: "drop-shadow(0 0 40px rgba(212,167,44,0.2))" }}
          />

          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="label-mono-accent">// Transmisión 0001</span>
              <span className="label-mono flex items-center gap-2">
                <span className="pulse-dot" />
                LIVE
              </span>
            </div>

            <pre className="mt-6 font-mono text-sm leading-relaxed text-[var(--color-text)]/85 whitespace-pre-line">
{`> Conexión establecida.
> Identidad:   no verificada
> Canal:       seguro
> Esperando autenticación...

Todo acceso a este terminal queda registrado.
Intentos no autorizados serán reportados a la
Oficina de Asuntos Internos. Al continuar,
reconoce las disposiciones permanentes de no
divulgación de la directiva 7-G de la UNSC.`}
            </pre>
          </div>

          <div className="relative mt-12 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono text-[var(--color-muted)]">
            <Row k="HOST" v="hub.unsc.local" />
            <Row k="BUILD" v="0.1.0" />
            <Row k="UPLINK" v="ENCRYPTED" />
            <Row
              k="STATUS"
              v={
                <span className="text-[var(--color-success)] flex items-center gap-2">
                  <span className="pulse-dot" />
                  ONLINE
                </span>
              }
            />
          </div>
        </aside>
      </section>

      <footer className="border-t border-[var(--color-border)] px-8 py-4 flex flex-wrap justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--color-muted)]">
        <span>
          {unit.parentAgency} <span className="text-[var(--color-accent)]">//</span>{" "}
          {unit.name}
        </span>
        <span>v0.1.0 — Build Seguro</span>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric">{value}</div>
      <div className="label-mono mt-2">{label}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-[var(--color-border)] pb-1.5">
      <span className="text-[var(--color-muted)]">{k}</span>
      <span className="text-[var(--color-text-dim)]">{v}</span>
    </div>
  );
}
