"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
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
      <div className="panel p-4 [--fc-border-color:var(--color-border)] [--fc-page-bg-color:var(--color-panel)] [--fc-neutral-bg-color:var(--color-base)] [--fc-list-event-hover-bg-color:var(--color-base)] [--fc-today-bg-color:rgba(201,162,39,0.08)] [--fc-event-bg-color:var(--color-accent)] [--fc-event-border-color:var(--color-accent)] [--fc-event-text-color:#000] [--fc-button-bg-color:var(--color-base)] [--fc-button-border-color:var(--color-border)] [--fc-button-hover-bg-color:var(--color-accent)] [--fc-button-hover-border-color:var(--color-accent)] [--fc-button-active-bg-color:var(--color-accent)] [--fc-button-active-border-color:var(--color-accent)]">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="auto"
          firstDay={0}
          events={events.map((e) => {
            const colorMap: Partial<Record<EventOutcome, string>> = {
              SUCCESS: "#16a34a",
              PARTIAL: "var(--color-accent)",
              FAILURE: "var(--color-danger)",
              CANCELLED: "#6b7280",
            };
            const c = colorMap[e.outcome];
            return {
              id: e.id,
              title: e.title,
              start: e.startsAt,
              end: e.endsAt ?? undefined,
              backgroundColor: c,
              borderColor: c,
              textColor: c ? "#fff" : undefined,
            };
          })}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            setOpenId(info.event.id);
          }}
        />
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
