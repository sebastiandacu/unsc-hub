"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Permission } from "@prisma/client";
import {
  setPermission,
  toggleBan,
  setRankOverride,
  setNickname,
  awardMedal,
  revokeMedal,
  awardPatch,
  revokePatch,
  awardMedalFromTemplate,
  awardPatchFromTemplate,
} from "@/lib/actions/admin";
import { ImageUploadButton } from "@/components/ImageUploadButton";

const PERMS: Permission[] = ["AUTHORIZED", "LICENSED", "CERTIFICATED", "ADMIN"];

type UserData = {
  id: string;
  nickname: string | null;
  discordUsername: string | null;
  avatarUrl: string | null;
  permission: Permission;
  banned: boolean;
  manualRankOverride: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  medals: { id: string; name: string; iconUrl: string | null }[];
  patches: { id: string; name: string; imageUrl: string | null }[];
};

type MedalTemplateLite = { id: string; name: string; iconUrl: string | null };
type PatchTemplateLite = { id: string; name: string; imageUrl: string | null };

export function UserRow({
  user,
  isSelf,
  medalTemplates,
  patchTemplates,
}: {
  user: UserData;
  isSelf: boolean;
  medalTemplates: MedalTemplateLite[];
  patchTemplates: PatchTemplateLite[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const display = user.nickname || user.discordUsername || "Operativo";

  return (
    <div className={`panel ${user.banned ? "border-[var(--color-danger)]/40" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--color-base)]/40 transition-colors"
      >
        <div className="size-10 border border-[var(--color-border)] overflow-hidden grid place-items-center bg-[var(--color-base)] shrink-0">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-mono text-xs text-[var(--color-muted)]">{display.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm truncate">
            {display}
            {isSelf && <span className="text-[var(--color-accent)] ml-2 text-xs">(tú)</span>}
          </div>
          <div className="label-mono truncate">{user.discordUsername ?? user.id}</div>
        </div>
        <div className="label-mono">{user.permission}</div>
        {user.banned && <div className="label-mono text-[var(--color-danger)]">BANNED</div>}
        <div className="label-mono">{open ? "▲" : "▼"}</div>
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] p-4 grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <div>
              <label className="label-mono block mb-1">Permiso</label>
              <select
                disabled={pending || isSelf}
                value={user.permission}
                onChange={(e) => start(() => setPermission(user.id, e.target.value as Permission))}
                className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono"
              >
                {PERMS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            <div>
              <label className="label-mono block mb-1">RP Name (nickname)</label>
              <NicknameField userId={user.id} initial={user.nickname} pending={pending} start={start} />
            </div>

            <div>
              <label className="label-mono block mb-1">Sobrescribir rango</label>
              <RankOverrideField userId={user.id} initial={user.manualRankOverride} pending={pending} start={start} />
            </div>

            <div className="flex gap-2">
              <button
                disabled={pending || isSelf}
                onClick={() => start(() => toggleBan(user.id))}
                className="btn"
              >
                {user.banned ? "Desbanear" : "Banear"}
              </button>
              <Link href={`/roster/${user.id}`} className="btn">Ver perfil</Link>
            </div>
          </div>

          <div className="space-y-5">
            <CollectibleSection
              kind="medal"
              label="Medallas"
              items={user.medals.map((m) => ({ id: m.id, name: m.name, imageUrl: m.iconUrl }))}
              templates={medalTemplates.map((t) => ({ id: t.id, name: t.name, imageUrl: t.iconUrl }))}
              onAwardTemplate={(tplId) => awardMedalFromTemplate(user.id, tplId)}
              onAwardCustom={(payload) => awardMedal({ userId: user.id, ...payload, iconUrl: payload.imageUrl })}
              onRevoke={(id) => revokeMedal(id)}
              uploadEndpoint="medalImage"
              pending={pending}
              start={start}
            />
            <CollectibleSection
              kind="patch"
              label="Parches"
              items={user.patches}
              templates={patchTemplates}
              onAwardTemplate={(tplId) => awardPatchFromTemplate(user.id, tplId)}
              onAwardCustom={(payload) => awardPatch({ userId: user.id, ...payload })}
              onRevoke={(id) => revokePatch(id)}
              uploadEndpoint="patchImage"
              pending={pending}
              start={start}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NicknameField({
  userId,
  initial,
  pending,
  start,
}: { userId: string; initial: string | null; pending: boolean; start: (cb: () => void) => void }) {
  const [val, setVal] = useState(initial ?? "");
  const dirty = (val.trim() || null) !== initial;
  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="(sin RP name)"
        maxLength={60}
        className="flex-1 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono text-xs"
      />
      <button
        disabled={pending || !dirty}
        onClick={() => start(() => setNickname(userId, val.trim() || null))}
        className="btn"
      >
        Guardar
      </button>
    </div>
  );
}

function RankOverrideField({
  userId,
  initial,
  pending,
  start,
}: { userId: string; initial: string | null; pending: boolean; start: (cb: () => void) => void }) {
  const [val, setVal] = useState(initial ?? "");
  const dirty = (val.trim() || null) !== initial;
  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="(ninguno — se deriva de Discord)"
        className="flex-1 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono text-xs"
      />
      <button
        disabled={pending || !dirty}
        onClick={() => start(() => setRankOverride(userId, val.trim() || null))}
        className="btn"
      >
        Guardar
      </button>
    </div>
  );
}

type AwardPayload = { name: string; description: string | null; imageUrl: string | null };
type CollectibleItem = { id: string; name: string; imageUrl: string | null };

function CollectibleSection({
  kind,
  label,
  items,
  templates,
  onAwardTemplate,
  onAwardCustom,
  onRevoke,
  uploadEndpoint,
  pending,
  start,
}: {
  kind: "medal" | "patch";
  label: string;
  items: CollectibleItem[];
  templates: CollectibleItem[];
  onAwardTemplate: (templateId: string) => Promise<void>;
  onAwardCustom: (payload: AwardPayload) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  uploadEndpoint: "medalImage" | "patchImage";
  pending: boolean;
  start: (cb: () => void) => void;
}) {
  const [tplId, setTplId] = useState<string>("");
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="label-mono">{label}</div>
      <ul className="space-y-1">
        {items.length === 0 && (
          <li className="text-[var(--color-muted)] text-xs">— sin {kind === "medal" ? "condecoraciones" : "parches"} —</li>
        )}
        {items.map((m) => (
          <li key={m.id} className="flex items-center gap-2 border border-[var(--color-border)] px-2 py-1.5">
            {m.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.imageUrl} alt="" className="size-7 object-contain shrink-0" />
            ) : (
              <div className="size-7 border border-[var(--color-accent)]/40 grid place-items-center text-[var(--color-accent)] font-mono text-xs shrink-0">
                {kind === "medal" ? "★" : "▣"}
              </div>
            )}
            <span className="font-mono text-xs truncate flex-1">{m.name}</span>
            <button
              disabled={pending}
              onClick={() => start(() => onRevoke(m.id))}
              className="label-mono text-[var(--color-danger)] hover:underline"
            >
              revocar
            </button>
          </li>
        ))}
      </ul>

      {/* Quick award from template */}
      <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
        {templates.length === 0 ? (
          <div className="text-[10px] text-[var(--color-muted)] italic font-mono">
            Sin plantillas —{" "}
            <Link href="/admin/templates" className="text-[var(--color-accent)] hover:underline">crea una</Link>.
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={tplId}
              onChange={(e) => setTplId(e.target.value)}
              className="flex-1 min-w-0 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono text-xs"
            >
              <option value="">— Otorgar de plantilla —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              disabled={pending || !tplId}
              onClick={() =>
                start(async () => {
                  await onAwardTemplate(tplId);
                  setTplId("");
                })
              }
              className="btn btn-primary"
            >
              Otorgar
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCustomOpen(!customOpen)}
          className="label-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          {customOpen ? "▾ Ocultar custom" : "▸ Otorgar custom (one-off)"}
        </button>

        {customOpen && (
          <CustomAwardForm
            cta={kind === "medal" ? "Otorgar medalla custom" : "Otorgar parche custom"}
            onSubmit={onAwardCustom}
            uploadEndpoint={uploadEndpoint}
            pending={pending}
            start={start}
          />
        )}
      </div>
    </div>
  );
}

function CustomAwardForm({
  cta,
  onSubmit,
  uploadEndpoint,
  pending,
  start,
}: {
  cta: string;
  onSubmit: (payload: AwardPayload) => Promise<void>;
  uploadEndpoint: "medalImage" | "patchImage";
  pending: boolean;
  start: (cb: () => void) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        start(async () => {
          await onSubmit({
            name: name.trim(),
            description: desc.trim() || null,
            imageUrl,
          });
          setName("");
          setDesc("");
          setImageUrl(null);
        });
      }}
      className="space-y-2 mt-1"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre"
        className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono text-xs"
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descripción (opcional)"
        className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <ImageUploadButton
          endpoint={uploadEndpoint}
          onUploaded={(url) => setImageUrl(url)}
          label={imageUrl ? "Reemplazar imagen" : "Subir imagen"}
        />
        {imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="size-8 object-contain border border-[var(--color-border)]" />
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
      <button disabled={pending || !name.trim()} className="btn w-full justify-center">{cta}</button>
    </form>
  );
}
