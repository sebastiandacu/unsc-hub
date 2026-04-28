"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { createThread } from "@/lib/actions/wall";

export function NewThreadDialog({ categorySlug }: { categorySlug: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyJson, setBodyJson] = useState<RichDoc | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
  }

  // Portal target — only available after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">+ Nuevo hilo</button>
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70" onClick={close}>
          <div className="min-h-full flex items-start sm:items-center justify-center p-4">
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !bodyJson) {
                setError("Título y cuerpo son obligatorios.");
                return;
              }
              start(async () => {
                try {
                  await createThread({ categorySlug, title: title.trim(), bodyJson, headerImageUrl, bannerImageUrl });
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              });
            }}
            className="panel w-full max-w-3xl p-6 space-y-4 my-8"
          >
            <h2 className="display-md" style={{ fontFamily: "var(--font-display)" }}>Nuevo Hilo</h2>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título"
              maxLength={200}
              className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono"
            />
            <ImagePicker label="Banner" url={bannerImageUrl} onChange={setBannerImageUrl} />
            <ImagePicker label="Header thumbnail" url={headerImageUrl} onChange={setHeaderImageUrl} />
            <RichEditor value={bodyJson} onChange={setBodyJson} placeholder="Post inicial..." imageEndpoint="threadImage" />
            {error && <div className="label-mono text-[var(--color-danger)]">{error}</div>}
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={close} className="btn">Cancelar</button>
              <button disabled={pending} className="btn btn-primary">
                {pending ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ImagePicker({
  label,
  url,
  onChange,
}: { label: string; url: string | null; onChange: (url: string | null) => void }) {
  return (
    <div className="flex items-center gap-3">
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
