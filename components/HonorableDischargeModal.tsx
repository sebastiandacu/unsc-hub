"use client";

/**
 * Reusable popup for filing a Honorable Discharge request. Surfaces from:
 *   - The "ABANDONAR" button on a slot in an exclusive team
 *   - (future) The join/apply flow when the user is locked into an exclusive
 *
 * Submits via `requestDischarge` server action; on success the parent
 * receives onDone() and typically refreshes / closes the slot panel.
 */

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { requestDischarge } from "@/lib/actions/discharge";

export function HonorableDischargeModal({
  open,
  fromTeamId,
  fromTeamName,
  toSlotId,
  toTeamName,
  onClose,
  onDone,
}: {
  open: boolean;
  fromTeamId: string;
  fromTeamName: string;
  /** Set when this discharge is for a SWITCH (not a pure leave). */
  toSlotId?: string;
  toTeamName?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset when reopening for a different team.
  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open, fromTeamId]);

  if (!open || !mounted) return null;

  const isSwitch = !!toSlotId;
  const headline = isSwitch ? "HONORABLE DISCHARGE + TRANSFERENCIA" : "HONORABLE DISCHARGE";
  const tooShort = reason.trim().length < 10;

  function submit() {
    if (tooShort || pending) return;
    setError(null);
    start(async () => {
      try {
        await requestDischarge({
          fromTeamId,
          reason: reason.trim(),
          toSlotId: toSlotId ?? null,
        });
        onDone?.();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-sm grid place-items-center p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-lg p-6 space-y-4"
      >
        <div>
          <div className="label-mono text-[var(--color-danger)]">// {headline}</div>
          <h3 className="font-mono text-lg mt-1">
            Solicitar baja de <span className="text-[var(--color-accent)]">{fromTeamName}</span>
          </h3>
          {isSwitch && toTeamName && (
            <div className="label-mono normal-case tracking-normal text-[var(--color-text-dim)] mt-1.5 text-[11px] leading-relaxed">
              Si se aprueba, automáticamente vas a quedar transferido a{" "}
              <span className="text-[var(--color-accent)] font-bold">{toTeamName}</span>.
            </div>
          )}
        </div>

        <div className="border border-dashed border-[var(--color-border-2)] bg-[var(--color-base-2)] p-3 text-[11px] text-[var(--color-text-dim)] leading-relaxed">
          Este equipo es exclusivo. Tu pedido se manda a la cadena de mando — un
          admin va a revisar la razón y decidir si aprueba o rechaza la baja. No
          podés salir hasta que se apruebe.
        </div>

        <div>
          <label className="label-mono block mb-1">Razón de la baja</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={5}
            maxLength={800}
            autoFocus
            placeholder="Explicá por qué necesitás dejar el equipo. Sé específico — el admin lo va a leer."
            className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-sm leading-relaxed"
          />
          <div
            className={`label-mono text-right mt-1 ${
              tooShort ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"
            }`}
          >
            {reason.trim().length}/800 · mínimo 10 caracteres
          </div>
        </div>

        {error && (
          <div className="label-mono text-[var(--color-danger)] normal-case tracking-normal">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            disabled={pending}
            onClick={onClose}
            className="btn"
          >
            Cancelar
          </button>
          <button
            disabled={pending || tooShort}
            onClick={submit}
            className="btn btn-danger"
          >
            {pending ? "Enviando..." : "Enviar pedido"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
