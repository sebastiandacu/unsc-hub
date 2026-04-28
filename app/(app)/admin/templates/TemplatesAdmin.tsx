"use client";

import { useState, useTransition } from "react";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import {
  createMedalTemplate,
  deleteMedalTemplate,
  createPatchTemplate,
  deletePatchTemplate,
} from "@/lib/actions/admin";

type Tpl = {
  id: string;
  name: string;
  description: string | null;
  iconUrl?: string | null;
  imageUrl?: string | null;
};

export function TemplatesAdmin({
  medals,
  patches,
}: {
  medals: Tpl[];
  patches: Tpl[];
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section
        kind="medal"
        title="Medallas"
        items={medals.map((m) => ({ ...m, image: m.iconUrl ?? null }))}
        onCreate={(p) => createMedalTemplate(p)}
        onDelete={(id) => deleteMedalTemplate(id)}
        endpoint="medalImage"
      />
      <Section
        kind="patch"
        title="Parches"
        items={patches.map((p) => ({ ...p, image: p.imageUrl ?? null }))}
        onCreate={(p) => createPatchTemplate(p)}
        onDelete={(id) => deletePatchTemplate(id)}
        endpoint="patchImage"
      />
    </div>
  );
}

type ItemView = { id: string; name: string; description: string | null; image: string | null };
type CreatePayload = { name: string; description: string | null; imageUrl: string | null };

function Section({
  kind,
  title,
  items,
  onCreate,
  onDelete,
  endpoint,
}: {
  kind: "medal" | "patch";
  title: string;
  items: ItemView[];
  onCreate: (payload: CreatePayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  endpoint: "medalImage" | "patchImage";
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  return (
    <section className="panel panel-bracket p-5 space-y-5">
      <header className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
        <h2 className="display-md" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
        <span className="label-mono">{items.length} plantillas</span>
      </header>

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-xs text-[var(--color-muted)] italic font-mono">— Sin plantillas. Crea la primera abajo. —</li>
        )}
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 border border-[var(--color-border)] p-2.5">
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt="" className="size-10 object-contain shrink-0" />
            ) : (
              <div className="size-10 border border-[var(--color-accent)]/40 grid place-items-center text-[var(--color-accent)] font-mono text-sm shrink-0">
                {kind === "medal" ? "★" : "▣"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm truncate">{it.name}</div>
              {it.description && (
                <div className="label-mono text-[var(--color-muted)] mt-0.5 break-words whitespace-normal leading-relaxed">{it.description}</div>
              )}
            </div>
            <button
              disabled={pending}
              onClick={() => {
                if (confirm(`¿Eliminar plantilla "${it.name}"?`)) start(() => onDelete(it.id));
              }}
              className="label-mono text-[var(--color-danger)] hover:underline shrink-0"
            >
              eliminar
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => {
            await onCreate({
              name: name.trim(),
              description: desc.trim() || null,
              imageUrl,
            });
            setName("");
            setDesc("");
            setImageUrl(null);
          });
        }}
        className="space-y-2 border-t border-[var(--color-border)] pt-4"
      >
        <div className="label-mono">Nueva plantilla</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (p.ej. Estrella de Servicio)"
          maxLength={80}
          className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1.5 font-mono text-sm"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descripción (opcional)"
          maxLength={500}
          className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1.5 font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <ImageUploadButton
            endpoint={endpoint}
            onUploaded={(url) => setImageUrl(url)}
            label={imageUrl ? "Reemplazar imagen" : "Subir imagen"}
          />
          {imageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="size-9 object-contain border border-[var(--color-border)]" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="label-mono text-[var(--color-danger)] hover:underline"
              >
                quitar
              </button>
            </>
          )}
        </div>
        <button disabled={pending || !name.trim()} className="btn btn-primary w-full justify-center">
          {pending ? "Creando..." : `+ Crear plantilla de ${kind === "medal" ? "medalla" : "parche"}`}
        </button>
      </form>
    </section>
  );
}
