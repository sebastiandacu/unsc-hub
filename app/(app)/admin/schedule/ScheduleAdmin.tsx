"use client";

import { useState, useTransition } from "react";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { createEvent, updateEvent, deleteEvent, announceEvent } from "@/lib/actions/events";

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
  rsvpCount: number;
};

function toLocalInput(d?: Date | null) {
  if (!d) return "";
  const date = new Date(d);
  const tz = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tz).toISOString().slice(0, 16);
}

export function ScheduleAdmin({ events }: { events: EventInfo[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setEditing(editing === "new" ? null : "new")} className="btn">
          {editing === "new" ? "Cancelar" : "+ Nueva operación"}
        </button>
      </div>

      {editing === "new" && (
        <EventForm onDone={() => setEditing(null)} />
      )}

      {events.length === 0 && editing !== "new" ? (
        <div className="panel p-12 text-center text-[var(--color-muted)]">Sin operaciones programadas.</div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="panel">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-mono">{e.title}</div>
                  <div className="label-mono mt-1">
                    {new Date(e.startsAt).toLocaleString()}
                    {e.endsAt && ` → ${new Date(e.endsAt).toLocaleString()}`}
                    {e.location && ` · ${e.location}`}
                  </div>
                </div>
                <span className="label-mono">{e.rsvpCount} RSVPs</span>
                <AnnounceButton id={e.id} title={e.title} />
                <button onClick={() => setEditing(editing === e.id ? null : e.id)} className="btn">
                  {editing === e.id ? "Cancelar" : "Editar"}
                </button>
                <DeleteButton id={e.id} title={e.title} />
              </div>
              {editing === e.id && (
                <div className="border-t border-[var(--color-border)] p-4">
                  <EventForm initial={e} onDone={() => setEditing(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DeleteButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(`¿Eliminar "${title}"?`)) start(() => deleteEvent(id));
      }}
      className="btn btn-danger"
    >Eliminar</button>
  );
}

function AnnounceButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Anunciar "${title}" en Discord + notificar a todos?`)) return;
        start(async () => {
          try {
            await announceEvent(id);
            setDone(true);
            setTimeout(() => setDone(false), 3000);
          } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
          }
        });
      }}
      className="btn"
      title="Re-postear en el canal de Discord + notificación in-app"
    >
      {pending ? "Enviando..." : done ? "✓ Enviado" : "📣 Anunciar"}
    </button>
  );
}

function EventForm({ initial, onDone }: { initial?: EventInfo; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ? new Date(initial.startsAt) : new Date(Date.now() + 86400000)));
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? toLocalInput(new Date(initial.endsAt)) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [briefingJson, setBriefingJson] = useState<RichDoc | null>(initial?.briefingJson ?? null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(initial?.headerImageUrl ?? null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(initial?.bannerImageUrl ?? null);
  const [slidesEmbedUrl, setSlidesEmbedUrl] = useState<string>(initial?.slidesEmbedUrl ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt || !briefingJson) {
      setError("Título, hora de inicio y briefing son obligatorios.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        const payload = {
          title: title.trim(),
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          location: location.trim() || null,
          briefingJson,
          headerImageUrl,
          bannerImageUrl,
          slidesEmbedUrl: slidesEmbedUrl.trim() || null,
        };
        if (initial) await updateEvent(initial.id, payload);
        else await createEvent(payload);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono" />
      <div className="grid sm:grid-cols-2 gap-3 text-xs font-mono">
        <label className="space-y-1">
          <div className="label-mono">Inicio</div>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-2" />
        </label>
        <label className="space-y-1">
          <div className="label-mono">Fin (opcional)</div>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-2" />
        </label>
      </div>
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ubicación" className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-2 font-mono text-xs" />

      <div>
        <div className="label-mono mb-1">Google Slides (URL del dossier)</div>
        <input
          type="url"
          value={slidesEmbedUrl}
          onChange={(e) => setSlidesEmbedUrl(e.target.value)}
          placeholder="https://docs.google.com/presentation/d/.../edit"
          className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-2 font-mono text-xs"
        />
        <div className="label-mono mt-1 text-[var(--color-muted)]">
          Pegá el link de cualquier presentación de Google Slides — se embebe en el briefing.
        </div>
      </div>

      <ImageRow label="Banner" url={bannerImageUrl} onChange={setBannerImageUrl} aspect="aspect-[5/2]" />
      <ImageRow label="Miniatura" url={headerImageUrl} onChange={setHeaderImageUrl} aspect="aspect-[16/9]" />

      <div>
        <div className="label-mono mb-2">Briefing</div>
        <RichEditor value={briefingJson} onChange={setBriefingJson} placeholder="Briefing de la misión..." imageEndpoint="postImage" />
      </div>

      {error && <div className="label-mono text-[var(--color-danger)]">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending ? "Guardando..." : initial ? "Guardar cambios" : "Crear operación"}</button>
      </div>
    </form>
  );
}

function ImageRow({
  label,
  url,
  onChange,
  aspect,
}: { label: string; url: string | null; onChange: (url: string | null) => void; aspect: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="label-mono w-32">{label}</span>
        <ImageUploadButton endpoint="postBanner" onUploaded={onChange} label={url ? "Reemplazar" : "Subir"} />
        {url && <button type="button" onClick={() => onChange(null)} className="btn">Quitar</button>}
      </div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`mt-2 w-full ${aspect} object-cover border border-[var(--color-border)]`} />
      )}
    </div>
  );
}
