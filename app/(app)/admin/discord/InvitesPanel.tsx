"use client";

import { useState, useTransition } from "react";
import { createInvite, revokeInvite, deleteInvite } from "@/lib/actions/invites";

type Invite = {
  id: string;
  code: string;
  label: string;
  createdByName: string;
  createdAt: string;
  maxUses: number | null;
  uses: number;
  redemptionCount: number;
  expiresAt: string | null;
  revoked: boolean;
};

const PUBLIC_BASE = process.env.NEXT_PUBLIC_SITE_URL || "";

export function InvitesPanel({ invites }: { invites: Invite[] }) {
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ code: string; label: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  function inviteUrl(code: string) {
    const base = PUBLIC_BASE || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/login?invite=${encodeURIComponent(code)}`;
  }

  async function copy(text: string, code: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
    } catch {
      /* swallow */
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setError(null);
    start(async () => {
      try {
        const r = await createInvite({
          label: label.trim(),
          maxUses: maxUses ? Number(maxUses) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        });
        setLastCreated({ code: r.code, label: label.trim() });
        setLabel("");
        setMaxUses("");
        setExpiresAt("");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <section className="panel-elevated panel-bracket p-5 space-y-5">
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <div>
          <div className="label-mono-accent">// CÓDIGOS DE INVITACIÓN</div>
          <h2 className="font-mono uppercase text-sm tracking-[0.16em] mt-1">
            Para partners y guests sin rol del server
          </h2>
        </div>
        <div className="label-mono">{invites.filter((i) => !i.revoked).length} activos</div>
      </div>

      <form onSubmit={submit} className="grid sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
        <div>
          <label className="label-mono block mb-1">Label / partner</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ej. Halo CE Argentina"
            maxLength={80}
            className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1.5 font-mono text-xs"
          />
        </div>
        <div>
          <label className="label-mono block mb-1">Max usos (opcional)</label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="ilimitado"
            className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1.5 font-mono text-xs"
          />
        </div>
        <div>
          <label className="label-mono block mb-1">Vence (opcional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1.5 font-mono text-xs"
          />
        </div>
        <button
          disabled={pending || !label.trim()}
          className="btn btn-primary"
        >
          {pending ? "..." : "+ Generar"}
        </button>
      </form>

      {error && (
        <div className="label-mono text-[var(--color-danger)] normal-case tracking-normal">
          {error}
        </div>
      )}

      {lastCreated && (
        <div className="border border-[var(--color-success)] bg-[var(--color-success)]/10 p-3.5 text-xs font-mono space-y-2">
          <div className="font-bold tracking-[0.2em] text-[var(--color-success)]">
            ✓ CÓDIGO GENERADO PARA {lastCreated.label.toUpperCase()}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span>Compartí este link:</span>
            <code className="bg-[var(--color-base)] px-2 py-1 border border-[var(--color-border)] text-[var(--color-accent)] break-all">
              {inviteUrl(lastCreated.code)}
            </code>
            <button
              type="button"
              onClick={() => copy(inviteUrl(lastCreated.code), lastCreated.code)}
              className="btn"
            >
              {copiedCode === lastCreated.code ? "✓ copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {invites.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border-2)] p-8 text-center label-mono text-[var(--color-muted)]">
          — Sin códigos generados todavía. Creá el primero arriba. —
        </div>
      ) : (
        <ul className="space-y-2">
          {invites.map((i) => {
            const exhausted = i.maxUses !== null && i.uses >= i.maxUses;
            const expired = !!i.expiresAt && new Date(i.expiresAt).getTime() < Date.now();
            const isActive = !i.revoked && !exhausted && !expired;
            return (
              <li
                key={i.id}
                className={`border p-3 flex items-center gap-3 flex-wrap ${
                  isActive
                    ? "border-[var(--color-border)]"
                    : "border-[var(--color-border)] opacity-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm flex items-center gap-2 flex-wrap">
                    <code className="text-[var(--color-accent)]">{i.code}</code>
                    <span className="label-mono normal-case tracking-[0.18em]">{i.label}</span>
                    {i.revoked && (
                      <span className="label-mono text-[var(--color-danger)]">REVOCADO</span>
                    )}
                    {!i.revoked && expired && (
                      <span className="label-mono text-[var(--color-amber)]">EXPIRADO</span>
                    )}
                    {!i.revoked && !expired && exhausted && (
                      <span className="label-mono text-[var(--color-amber)]">SIN USOS</span>
                    )}
                  </div>
                  <div className="label-mono mt-1 normal-case tracking-normal text-[var(--color-text-dim)]">
                    {i.uses}{i.maxUses !== null ? `/${i.maxUses}` : ""} usos · {i.redemptionCount}{" "}
                    redenciones · creado por {i.createdByName} ·{" "}
                    {new Date(i.createdAt).toLocaleDateString("es-AR")}
                    {i.expiresAt && (
                      <> · vence {new Date(i.expiresAt).toLocaleDateString("es-AR")}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(inviteUrl(i.code), i.code)}
                  className="btn"
                  disabled={!isActive}
                  title={isActive ? "Copiar link de invitación" : "Código no usable"}
                >
                  {copiedCode === i.code ? "✓ copiado" : "Copiar link"}
                </button>
                {!i.revoked && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`¿Revocar el código ${i.code}? No se puede deshacer.`)) return;
                      start(() => revokeInvite(i.id));
                    }}
                    className="btn"
                  >
                    Revocar
                  </button>
                )}
                {(i.revoked || expired || exhausted) && i.redemptionCount === 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`¿Borrar definitivamente el código ${i.code}?`)) return;
                      start(() => deleteInvite(i.id));
                    }}
                    className="btn btn-danger"
                  >
                    Borrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
