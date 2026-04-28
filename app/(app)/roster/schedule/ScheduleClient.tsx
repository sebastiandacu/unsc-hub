"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { RsvpStatus, EventOutcome } from "@prisma/client";
import { setRsvp, setEventOutcome } from "@/lib/actions/events";
import { RichRenderer } from "@/components/editor/RichRenderer";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { toSlidesEmbedUrl } from "@/lib/slides";

type EventInfo = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  briefingJson: object;
  headerImageUrl: string | null;
  bannerImageUrl: string | null;
  slidesEmbedUrl: string | null;
  outcome: EventOutcome;
  aarJson: object | null;
  aarPostedAt: string | null;
  rsvps: { userId: string; name: string; status: RsvpStatus }[];
};

const STATUSES: RsvpStatus[] = ["GOING", "MAYBE", "DECLINED"];
const OUTCOMES: EventOutcome[] = ["PENDING", "SUCCESS", "PARTIAL", "FAILURE", "CANCELLED"];

const OUTCOME_STYLES: Record<EventOutcome, { fg: string; bg: string; label: string }> = {
  PENDING:   { fg: "var(--color-muted)",  bg: "transparent",                     label: "PENDING" },
  SUCCESS:   { fg: "#0a0",                 bg: "rgba(0,170,0,0.10)",              label: "✓ SUCCESS" },
  PARTIAL:   { fg: "var(--color-accent)",  bg: "var(--color-accent-soft)",        label: "◐ PARTIAL" },
  FAILURE:   { fg: "var(--color-danger)",  bg: "rgba(220,38,38,0.10)",            label: "✕ FAILURE" },
  CANCELLED: { fg: "var(--color-muted)",   bg: "rgba(150,150,150,0.10)",          label: "⊘ CANCELLED" },
};

export function ScheduleClient({ userId, isAdmin, events }: { userId: string; isAdmin: boolean; events: EventInfo[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Deep-link: /roster/schedule?event=<id> auto-opens the briefing modal.
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("event");
      if (id && events.some((e) => e.id === id)) setOpenId(id);
    }
  }, [events]);

  const open = events.find((e) => e.id === openId) ?? null;
  const myRsvp = open?.rsvps.find((r) => r.userId === userId)?.status ?? null;

  return (
    <>
      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1fr)" }}>
        <MonthGrid events={events} onPick={(id) => setOpenId(id)} />
        <UpcomingPanel events={events} onPick={(id) => setOpenId(id)} />
      </div>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70" onClick={() => setOpenId(null)}>
          <div className="min-h-full flex items-start sm:items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="panel w-full max-w-3xl my-8">
            {open.bannerImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.bannerImageUrl} alt="" className="w-full max-h-[260px] object-cover border-b border-[var(--color-border)]" />
            )}
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-mono text-xl">{open.title}</h2>
                    <OutcomeBadge outcome={open.outcome} />
                  </div>
                  <div className="label-mono mt-2">
                    {new Date(open.startsAt).toLocaleString()}
                    {open.endsAt && ` → ${new Date(open.endsAt).toLocaleString()}`}
                    {open.location && ` · ${open.location}`}
                  </div>
                </div>
                <button onClick={() => setOpenId(null)} className="btn shrink-0">Cerrar</button>
              </div>

              <div className="panel p-4">
                <div className="label-mono mb-2">Briefing</div>
                <RichRenderer doc={open.briefingJson} />
              </div>

              {(() => {
                const embed = toSlidesEmbedUrl(open.slidesEmbedUrl);
                if (!embed) return null;
                return (
                  <div className="panel p-4">
                    <div className="label-mono mb-2 flex items-center justify-between">
                      <span>Operation Dossier</span>
                      <a
                        href={open.slidesEmbedUrl ?? embed}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-[var(--color-accent)]"
                      >abrir en Slides ↗</a>
                    </div>
                    <div className="aspect-video w-full border border-[var(--color-border)] bg-black">
                      <iframe
                        src={embed}
                        className="w-full h-full"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              })()}

              {open.aarJson && (
                <div className="panel p-4 border-l-2" style={{ borderLeftColor: OUTCOME_STYLES[open.outcome].fg }}>
                  <div className="label-mono mb-2 flex items-center justify-between">
                    <span>After-Action Report</span>
                    {open.aarPostedAt && (
                      <span className="text-[var(--color-muted)]">{new Date(open.aarPostedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <RichRenderer doc={open.aarJson} />
                </div>
              )}

              {isAdmin && <AarAdminForm event={open} />}

              <div>
                <div className="label-mono mb-2">RSVP</div>
                <div className="flex gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      disabled={pending}
                      onClick={() => start(() => setRsvp(open.id, s))}
                      className={`btn ${myRsvp === s ? "border-[var(--color-accent)] text-[var(--color-accent)]" : ""}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="label-mono mb-2">Respuestas</div>
                {open.rsvps.length === 0 ? (
                  <div className="text-xs text-[var(--color-muted)]">Sin RSVPs todavía.</div>
                ) : (
                  <ul className="text-xs font-mono space-y-1">
                    {open.rsvps.map((r) => (
                      <li key={r.userId} className="flex justify-between border-b border-[var(--color-border)] py-1">
                        <span>{r.name}</span>
                        <span className={r.status === "GOING" ? "text-[var(--color-accent)]" : r.status === "DECLINED" ? "text-[var(--color-danger)]" : ""}>{r.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function OutcomeBadge({ outcome }: { outcome: EventOutcome }) {
  const s = OUTCOME_STYLES[outcome];
  if (outcome === "PENDING") return null;
  return (
    <span
      className="label-mono px-2 py-0.5 border"
      style={{ color: s.fg, backgroundColor: s.bg, borderColor: s.fg }}
    >
      {s.label}
    </span>
  );
}

function AarAdminForm({ event }: { event: EventInfo }) {
  const [outcome, setOutcome] = useState<EventOutcome>(event.outcome);
  const [aarJson, setAarJson] = useState<RichDoc | null>((event.aarJson ?? null) as RichDoc | null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  return (
    <div className="panel p-4 space-y-3 border-dashed">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="label-mono flex items-center gap-2 text-[var(--color-accent)]"
      >
        {open ? "▾" : "▸"} ADMIN · After-Action Report
        {savedAt && <span className="text-[var(--color-muted)]">(guardado)</span>}
      </button>

      {open && (
        <div className="space-y-3">
          <div>
            <div className="label-mono mb-2">Resultado</div>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => {
                const s = OUTCOME_STYLES[o];
                const active = outcome === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    className="label-mono px-2.5 py-1 border transition-colors"
                    style={{
                      color: active ? s.fg : "var(--color-muted)",
                      backgroundColor: active ? s.bg : "transparent",
                      borderColor: active ? s.fg : "var(--color-border)",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="label-mono mb-2">AAR (opcional)</div>
            <RichEditor
              value={aarJson}
              onChange={setAarJson}
              placeholder="Resumen, casualties, lecciones aprendidas..."
              imageEndpoint="postImage"
            />
          </div>

          {error && <div className="label-mono text-[var(--color-danger)]">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  try {
                    await setEventOutcome(event.id, { outcome, aarJson });
                    setSavedAt(Date.now());
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                });
              }}
              className="btn btn-primary"
            >
              {pending ? "Guardando..." : "Guardar AAR"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MONTH GRID — UNSC-styled calendar (replaces FullCalendar)
// ============================================================

const MONTHS_ES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_ES_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const DOW_ES = ["L", "M", "X", "J", "V", "S", "D"]; // Monday-first

function outcomeColor(outcome: EventOutcome): string {
  switch (outcome) {
    case "SUCCESS":   return "var(--color-success)";
    case "PARTIAL":   return "var(--color-accent)";
    case "FAILURE":   return "var(--color-danger)";
    case "CANCELLED": return "var(--color-muted)";
    default:          return "var(--color-accent)";
  }
}

function MonthGrid({
  events,
  onPick,
}: {
  events: EventInfo[];
  onPick: (id: string) => void;
}) {
  // Anchor on today, navigate by months.
  const today = new Date();
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Build the cells: pad start to the previous Monday, fill 6 weeks (42 cells).
  const { cells, monthIndex, year } = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const firstOfMonth = new Date(y, m, 1);
    // Monday-first: getDay returns 0=Sun, 1=Mon... shift so Monday=0.
    const lead = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(y, m, 1 - lead);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return { cells: out, monthIndex: m, year: y };
  }, [anchor]);

  // Index events by YYYY-MM-DD of their start (in ART so the ART input the
  // admin typed lines up with the visible cell).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventInfo[]>();
    for (const e of events) {
      const d = new Date(e.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const goPrev = () => setAnchor(new Date(year, monthIndex - 1, 1));
  const goNext = () => setAnchor(new Date(year, monthIndex + 1, 1));
  const goToday = () => setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="panel-elevated panel-bracket">
      <div className="px-4 py-3.5 border-b border-[var(--color-border)] flex justify-between items-center flex-wrap gap-3">
        <span
          className="uppercase font-semibold tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-display)", fontSize: 22 }}
        >
          {MONTHS_ES_LONG[monthIndex]}{" "}
          <span style={{ color: "var(--color-accent)" }}>{year}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={goPrev} className="chip">‹ ANTERIOR</button>
          <button onClick={goToday} className="chip">HOY</button>
          <button onClick={goNext} className="chip">SIGUIENTE ›</button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div
        className="grid border-b border-[var(--color-border)]"
        style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
      >
        {DOW_ES.map((d) => (
          <div
            key={d}
            className="py-2 text-center font-mono text-[9px] tracking-[0.22em] text-[var(--color-muted)] border-r border-[var(--color-border)] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          gridAutoRows: "minmax(80px, auto)",
        }}
      >
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === monthIndex;
          const today_ = isToday(d);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const items = eventsByDay.get(key) ?? [];
          return (
            <div
              key={i}
              className="border-r border-b border-[var(--color-border)] last:border-r-0 p-2 relative min-h-[80px]"
              style={{
                background: today_ ? "var(--color-accent-soft)" : "transparent",
                opacity: inMonth ? 1 : 0.35,
              }}
            >
              <div
                className="font-mono text-[11px]"
                style={{
                  color: today_
                    ? "var(--color-accent)"
                    : inMonth
                      ? "var(--color-text-dim)"
                      : "var(--color-muted)",
                }}
              >
                {String(d.getDate()).padStart(2, "0")}
              </div>
              {items.slice(0, 3).map((e) => {
                const c = outcomeColor(e.outcome);
                return (
                  <button
                    key={e.id}
                    onClick={() => onPick(e.id)}
                    className="block mt-1 w-full text-left hover:bg-[var(--color-panel-2)] transition-colors"
                    style={{
                      padding: "3px 6px",
                      borderLeft: `2px solid ${c}`,
                      background: "var(--color-base-2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: c,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                    title={`${e.title}${e.location ? ` · ${e.location}` : ""}`}
                  >
                    <span className="block truncate">{e.title}</span>
                  </button>
                );
              })}
              {items.length > 3 && (
                <div className="mt-1 font-mono text-[9px] text-[var(--color-muted)]">
                  +{items.length - 3} más
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingPanel({
  events,
  onPick,
}: {
  events: EventInfo[];
  onPick: (id: string) => void;
}) {
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.startsAt).getTime() >= Date.now())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .slice(0, 8),
    [events],
  );

  return (
    <div className="panel-elevated panel-bracket">
      <div className="px-4 py-3.5 border-b border-[var(--color-border)]">
        <span className="label-mono-accent">// PRÓXIMAS OPS</span>
      </div>
      {upcoming.length === 0 ? (
        <div className="p-6 text-center font-mono text-xs text-[var(--color-muted)]">
          — Sin operaciones próximas. —
        </div>
      ) : (
        <div>
          {upcoming.map((e) => {
            const d = new Date(e.startsAt);
            const time = d.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Argentina/Buenos_Aires",
              hour12: false,
            });
            const detailParts = [`${time} ART`];
            if (e.location) detailParts.push(e.location);
            return (
              <button
                key={e.id}
                onClick={() => onPick(e.id)}
                className="w-full grid items-center gap-3.5 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-panel-2)] transition-colors text-left"
                style={{ gridTemplateColumns: "auto 1fr auto" }}
              >
                <div
                  className="text-center w-[50px]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <div
                    className="text-[22px] leading-none font-bold"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {String(d.getDate()).padStart(2, "0")}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-[var(--color-muted)] mt-0.5">
                    {MONTHS_ES_SHORT[d.getMonth()]}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] text-[var(--color-text)] truncate">
                    {e.title}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--color-muted)] truncate">
                    {detailParts.join(" · ")}
                  </div>
                </div>
                <span className="text-[var(--color-muted)]">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
