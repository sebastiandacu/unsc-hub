"use client";

import { useState, useTransition } from "react";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { updateOwnProfile } from "@/lib/actions/profile";

export function ProfileEditor({
  initialNickname,
  initialBio,
  initialAvatarUrl,
}: {
  initialNickname: string;
  initialBio: string;
  initialAvatarUrl: string | null;
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const dirty = nickname !== initialNickname || bio !== initialBio;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          await updateOwnProfile({ nickname, bio });
          setSaved(true);
        });
      }}
      className="space-y-5"
    >
      <section className="panel p-5">
        <div className="label-mono">Avatar</div>
        <div className="flex items-center gap-5 mt-3">
          <div className="size-20 border border-[var(--color-border)] overflow-hidden bg-[var(--color-base)] grid place-items-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-mono text-xl text-[var(--color-muted)]">??</span>
            )}
          </div>
          <ImageUploadButton
            endpoint="avatar"
            label={avatarUrl ? "Reemplazar" : "Subir"}
            onUploaded={(url) => setAvatarUrl(url)}
          />
        </div>
        <p className="label-mono mt-3 normal-case tracking-normal text-[10.5px] text-[var(--color-text-dim)]">
          El avatar se sube directamente a tu perfil y persiste entre sesiones.
        </p>
      </section>

      <section className="panel p-5">
        <label htmlFor="nickname" className="label-mono">RP Nickname</label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={40}
          placeholder="ej. Agente Cross"
          className="mt-2 w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono"
        />
        <p className="label-mono mt-2 normal-case tracking-normal text-[10.5px] text-[var(--color-text-dim)]">Se muestra en el roster en lugar de tu handle de Discord.</p>
      </section>

      <section className="panel p-5">
        <label htmlFor="bio" className="label-mono">Bio</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={1000}
          rows={8}
          placeholder="Antecedentes, especialidades, historial de despliegues..."
          className="mt-2 w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-sm resize-y"
        />
        <div className="label-mono mt-2 text-right">{bio.length}/1000</div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={pending || !dirty} className="btn btn-primary">
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && !dirty && <span className="label-mono-accent">Guardado.</span>}
      </div>
    </form>
  );
}
