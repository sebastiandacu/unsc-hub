"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { createGalleryItem, updateGalleryItem, deleteGalleryItem } from "@/lib/actions/gallery";

type Item = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  mediaType: "image" | "video" | string;
  createdAt: string;
  uploadedByName: string;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;
const isVideoUrl = (url: string) => VIDEO_EXT.test(url);
const isVideo = (it: { mediaType?: string; imageUrl: string }) =>
  it.mediaType === "video" || (!it.mediaType && isVideoUrl(it.imageUrl));

export function GalleryClient({ isAdmin, items }: { isAdmin: boolean; items: Item[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <>
      {isAdmin && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => { setComposerOpen(!composerOpen); setEditing(null); }}
            className="btn"
          >
            {composerOpen ? "Cancelar" : "+ Subir foto"}
          </button>
        </div>
      )}

      {isAdmin && composerOpen && (
        <div className="mb-6">
          <Composer
            initial={editing}
            onDone={() => { setComposerOpen(false); setEditing(null); }}
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="panel p-16 text-center text-[var(--color-muted)] font-mono">
          — Galería vacía. {isAdmin ? "Subí la primera foto." : "Esperando que un admin suba contenido."} —
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => setOpenId(it.id)}
              className="group relative aspect-square overflow-hidden border border-[var(--color-border)] bg-[var(--color-base)] hover:border-[var(--color-accent)] transition-colors"
            >
              {isVideo(it) ? (
                <video
                  src={it.imageUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={it.imageUrl}
                  alt={it.title}
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              {isVideo(it) && (
                <span className="absolute top-2 right-2 label-mono text-[8.5px] bg-[var(--color-accent)] text-black px-1.5 py-0.5 font-bold">
                  ▶ VIDEO
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="font-mono text-sm text-white truncate text-left">{it.title}</div>
                <div className="label-mono text-[var(--color-accent)] mt-0.5 text-left">VER →</div>
              </div>
              <span className="absolute top-2 left-2 label-mono text-[8.5px] bg-black/70 px-1.5 py-0.5 text-white">
                {new Date(it.createdAt).toLocaleDateString("es-ES")}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/85 backdrop-blur-sm" onClick={() => setOpenId(null)}>
          <div className="min-h-full flex items-start sm:items-center justify-center p-4">
            <div onClick={(e) => e.stopPropagation()} className="panel w-full max-w-4xl my-8">
              <div className="bg-black grid place-items-center max-h-[75vh] overflow-hidden border-b border-[var(--color-border)]">
                {isVideo(open) ? (
                  <video
                    src={open.imageUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-w-full max-h-[75vh] object-contain"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={open.imageUrl} alt={open.title} className="max-w-full max-h-[75vh] object-contain" />
                )}
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-mono text-xl">{open.title}</h2>
                    <div className="label-mono mt-1.5">
                      Subido por {open.uploadedByName} · {new Date(open.createdAt).toLocaleDateString("es-ES", { dateStyle: "long" })}
                    </div>
                  </div>
                  <button onClick={() => setOpenId(null)} className="btn shrink-0">Cerrar</button>
                </div>

                {open.description ? (
                  <p className="text-sm text-[var(--color-text)]/90 whitespace-pre-line leading-relaxed">
                    {open.description}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-muted)] italic">(Sin descripción.)</p>
                )}

                {isAdmin && (
                  <div className="flex gap-2 pt-3 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => {
                        setEditing(open);
                        setComposerOpen(true);
                        setOpenId(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="btn"
                    >
                      Editar
                    </button>
                    <DeleteButton id={open.id} title={open.title} onDone={() => setOpenId(null)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function DeleteButton({ id, title, onDone }: { id: string; title: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Eliminar "${title}" de la galería?`)) return;
        start(async () => {
          await deleteGalleryItem(id);
          onDone();
        });
      }}
      className="btn btn-danger"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}

function Composer({ initial, onDone }: { initial: Item | null; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [mediaType, setMediaType] = useState<"image" | "video">(
    initial?.mediaType === "video" ? "video" : "image",
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !imageUrl) {
      setError("Título y media son obligatorios.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        if (initial) {
          await updateGalleryItem(initial.id, {
            title: title.trim(),
            description: description.trim() || null,
            imageUrl,
            mediaType,
          });
        } else {
          await createGalleryItem({
            title: title.trim(),
            description: description.trim() || null,
            imageUrl,
            mediaType,
          });
        }
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <form onSubmit={submit} className="panel p-5 space-y-4">
      <div className="label-mono">{initial ? "Editar foto" : "Nueva foto"}</div>

      <div className="flex items-start gap-4">
        {imageUrl ? (
          <div className="size-32 border border-[var(--color-border)] bg-black overflow-hidden shrink-0">
            {mediaType === "video" ? (
              <video src={imageUrl} muted playsInline className="size-full object-cover" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imageUrl} alt="" className="size-full object-cover" />
            )}
          </div>
        ) : (
          <div className="size-32 grid place-items-center border border-dashed border-[var(--color-border)] text-[var(--color-muted)] label-mono shrink-0 text-center px-2">
            SIN MEDIA
          </div>
        )}
        <div className="flex flex-col gap-2">
          <ImageUploadButton
            endpoint="galleryImage"
            accept="image/*,video/*"
            label={imageUrl ? "Cambiar media" : "Subir foto o video"}
            onUploaded={(url, meta) => {
              setImageUrl(url);
              if (meta?.mediaType) setMediaType(meta.mediaType);
              else setMediaType(isVideoUrl(url) ? "video" : "image");
            }}
          />
          {imageUrl && (
            <button
              type="button"
              onClick={() => { setImageUrl(""); setMediaType("image"); }}
              className="label-mono text-[var(--color-danger)] hover:underline text-left"
            >
              quitar media
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label-mono block mb-1">Título</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="ej. OPERATION SILENT KEEP — extracción Beaumont"
          className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-sm"
        />
      </div>

      <div>
        <label className="label-mono block mb-1">Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Contexto, fecha real, créditos al fotógrafo, etc."
          className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-sm leading-relaxed"
        />
      </div>

      {error && <div className="label-mono text-[var(--color-danger)]">{error}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Guardando..." : initial ? "Guardar cambios" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
