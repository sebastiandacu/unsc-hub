"use client";

import { useState, useTransition } from "react";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { createBulletin, updateBulletin } from "@/lib/actions/bulletin";
import { VisibilityControls, type TeamOption } from "@/components/VisibilityControls";

type Initial = {
  id?: string;
  title: string;
  bodyJson: RichDoc | null;
  headerImageUrl: string | null;
  bannerImageUrl: string | null;
  pinned: boolean;
  postToDiscord: boolean;
  pingEveryone: boolean;
  restrictedTeamIds: string[];
};

const EMPTY: Initial = {
  title: "",
  bodyJson: null,
  headerImageUrl: null,
  bannerImageUrl: null,
  pinned: false,
  postToDiscord: true,
  pingEveryone: true,
  restrictedTeamIds: [],
};

export function BulletinComposer({
  mode,
  initial = EMPTY,
  teams,
}: {
  mode: "create" | "edit";
  initial?: Initial;
  teams: TeamOption[];
}) {
  const [title, setTitle] = useState(initial.title);
  const [bodyJson, setBodyJson] = useState<RichDoc | null>(initial.bodyJson);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(initial.headerImageUrl);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(initial.bannerImageUrl);
  const [pinned, setPinned] = useState(initial.pinned);
  const [postToDiscord, setPostToDiscord] = useState(initial.postToDiscord);
  const [pingEveryone, setPingEveryone] = useState(initial.pingEveryone);
  const [restrictedTeamIds, setRestrictedTeamIds] = useState<string[]>(initial.restrictedTeamIds);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !bodyJson) {
      setError("Título y cuerpo son obligatorios.");
      return;
    }
    start(async () => {
      try {
        const payload = {
          title: title.trim(),
          bodyJson,
          headerImageUrl,
          bannerImageUrl,
          pinned,
          postToDiscord,
          pingEveryone,
          restrictedTeamIds,
        };
        if (mode === "create") await createBulletin(payload);
        else await updateBulletin(initial.id!, payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="panel p-5">
        <label className="label-mono">Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Briefing de misión, anuncio, etc."
          className="mt-2 w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-lg"
        />
      </section>

      <section className="panel p-5 space-y-3">
        <ImageSlot
          label="Imagen banner"
          hint="Hero ancho mostrado al inicio del post."
          url={bannerImageUrl}
          onChange={setBannerImageUrl}
          aspect="aspect-[5/2]"
        />
        <ImageSlot
          label="Imagen header / tarjeta"
          hint="Miniatura mostrada en la lista de bulletins."
          url={headerImageUrl}
          onChange={setHeaderImageUrl}
          aspect="aspect-[16/9]"
        />
      </section>

      <section>
        <div className="label-mono mb-2">Cuerpo</div>
        <RichEditor value={bodyJson} onChange={setBodyJson} placeholder="Escribe el bulletin..." imageEndpoint="postImage" />
      </section>

      <VisibilityControls
        teams={teams}
        postToDiscord={postToDiscord}
        pingEveryone={pingEveryone}
        restrictedTeamIds={restrictedTeamIds}
        onPostToDiscord={setPostToDiscord}
        onPingEveryone={setPingEveryone}
        onRestrictedTeamIds={setRestrictedTeamIds}
        scopeLabel="boletín"
      />

      <section className="panel p-5 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-mono">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Fijar arriba
        </label>
        <div className="flex-1" />
        {error && <span className="label-mono text-[var(--color-danger)]">{error}</span>}
        <button disabled={pending} className="btn btn-primary">
          {pending ? "Guardando..." : mode === "create" ? "Publicar" : "Guardar cambios"}
        </button>
      </section>
    </form>
  );
}

function ImageSlot({
  label,
  hint,
  url,
  onChange,
  aspect,
}: {
  label: string;
  hint: string;
  url: string | null;
  onChange: (url: string | null) => void;
  aspect: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="label-mono">{label}</div>
          <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          <ImageUploadButton endpoint="postBanner" onUploaded={onChange} label={url ? "Reemplazar" : "Subir"} />
          {url && (
            <button type="button" onClick={() => onChange(null)} className="btn">Quitar</button>
          )}
        </div>
      </div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`mt-3 w-full ${aspect} object-cover border border-[var(--color-border)]`} />
      )}
    </div>
  );
}
