"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { updateThread } from "@/lib/actions/wall";

type Initial = {
  title: string;
  bodyJson: RichDoc | null;
  headerImageUrl: string | null;
  bannerImageUrl: string | null;
};

export function ThreadEditor({
  threadId,
  categorySlug,
  initial,
}: {
  threadId: string;
  categorySlug: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [bodyJson, setBodyJson] = useState<RichDoc | null>(initial.bodyJson);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(initial.headerImageUrl);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(initial.bannerImageUrl);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !bodyJson) {
          setError("Título y cuerpo son obligatorios.");
          return;
        }
        setError(null);
        start(async () => {
          try {
            await updateThread(threadId, { title: title.trim(), bodyJson, headerImageUrl, bannerImageUrl });
            router.push(`/wall/${categorySlug}/${threadId}`);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
      }}
      className="space-y-5"
    >
      <section className="panel p-5">
        <label className="label-mono">Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="mt-2 w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-lg"
        />
      </section>

      <section className="panel p-5 space-y-4">
        <ImageSlot label="Banner" url={bannerImageUrl} onChange={setBannerImageUrl} />
        <ImageSlot label="Header thumbnail" url={headerImageUrl} onChange={setHeaderImageUrl} />
      </section>

      <section>
        <div className="label-mono mb-2">Cuerpo</div>
        <RichEditor value={bodyJson} onChange={setBodyJson} placeholder="Edita el post..." imageEndpoint="threadImage" />
      </section>

      <section className="panel p-5 flex items-center gap-3">
        {error && <span className="label-mono text-[var(--color-danger)]">{error}</span>}
        <div className="flex-1" />
        <button type="button" onClick={() => router.back()} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </section>
    </form>
  );
}

function ImageSlot({
  label,
  url,
  onChange,
}: { label: string; url: string | null; onChange: (url: string | null) => void }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="label-mono w-32">{label}</span>
      <ImageUploadButton endpoint="threadImage" onUploaded={onChange} label={url ? "Reemplazar" : "Subir"} />
      {url && (
        <>
          <button type="button" onClick={() => onChange(null)} className="btn">Quitar</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-12 border border-[var(--color-border)]" />
        </>
      )}
    </div>
  );
}
