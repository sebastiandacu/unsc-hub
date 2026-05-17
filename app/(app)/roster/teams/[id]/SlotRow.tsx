"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { JoinMode } from "@prisma/client";
import { joinSlot, leaveSlot, applyToSlot } from "@/lib/actions/teams";
import { HonorableDischargeModal } from "@/components/HonorableDischargeModal";

type Slot = {
  id: string;
  title: string;
  roleName: string | null;
  joinMode: JoinMode;
  minRankPriority: number | null;
  holder: { id: string; nickname: string | null; discordUsername: string | null; avatarUrl: string | null } | null;
};

export function SlotRow({
  slot,
  team,
  isMine,
  myPending,
  hasPendingDischarge,
  viewerExclusiveBlockers,
  rankLabels,
}: {
  slot: Slot;
  team: { id: string; name: string; allowsMultiMembership: boolean };
  isMine: boolean;
  myPending: boolean;
  /** True when the current viewer already has a pending Honorable Discharge from this team. */
  hasPendingDischarge?: boolean;
  /**
   * Exclusive teams the viewer holds slots in OTHER than this one. When
   * non-empty, attempts to Unirse/Solicitar on this slot are rerouted to
   * the discharge modal instead — same end goal, but the user gets the
   * "you must request discharge" path immediately instead of submitting
   * an application that the server will reject.
   */
  viewerExclusiveBlockers?: { id: string; name: string }[];
  rankLabels: Record<number, string>;
}) {
  const minLabel =
    slot.minRankPriority !== null
      ? rankLabels[slot.minRankPriority] ?? `#${slot.minRankPriority}`
      : null;
  const [pending, start] = useTransition();
  const [warn, setWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  /** Modal mode: "leave" = abandon current slot, "switch" = leave + take this slot. */
  const [dischargeMode, setDischargeMode] = useState<"leave" | "switch" | null>(null);

  const isExclusive = !team.allowsMultiMembership;
  // First (typically only) exclusive team the viewer is in. The discharge
  // flow only kicks in when the TARGET team is also exclusive — joining
  // a non-exclusive team alongside an exclusive one is fine, since the
  // target explicitly allows multi-membership.
  const blocker = viewerExclusiveBlockers?.[0] ?? null;
  const blockedFromActing = !!blocker && blocker.id !== team.id && isExclusive;

  function tryJoin(confirmRelease = false) {
    setError(null);
    setWarn(null);
    start(async () => {
      const r = await joinSlot(slot.id, confirmRelease);
      if (r.warn) setWarn(r.warn);
      else if (r.error) setError(r.error);
    });
  }

  function submitApplication() {
    setError(null);
    start(async () => {
      const r = await applyToSlot(slot.id, applyMsg);
      if (r.error) setError(r.error);
      else {
        setApplyOpen(false);
        setApplyMsg("");
      }
    });
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm flex items-baseline gap-2 flex-wrap">
            <span>{slot.title}</span>
            {slot.roleName && (
              <span className="label-mono-accent text-[10px] tracking-[0.18em]">{slot.roleName}</span>
            )}
          </div>
          <div className="label-mono mt-1">
            {slot.joinMode === "OPEN" ? "Abierto" : "Requiere solicitud"}
            {minLabel && ` · rango mínimo ${minLabel}`}
          </div>
        </div>

        {slot.holder ? (
          <Link href={`/roster/${slot.holder.id}`} className="flex items-center gap-2 hover:text-[var(--color-accent)]">
            <div className="size-7 border border-[var(--color-border)] overflow-hidden grid place-items-center bg-[var(--color-base)]">
              {slot.holder.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slot.holder.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="font-mono text-[10px]">{(slot.holder.nickname ?? slot.holder.discordUsername ?? "??").slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span className="font-mono text-xs truncate max-w-[160px]">{slot.holder.nickname ?? slot.holder.discordUsername}</span>
          </Link>
        ) : (
          <span className="label-mono text-[var(--color-muted)]">VACANT</span>
        )}

        <div className="ml-2">
          {isMine ? (
            isExclusive ? (
              hasPendingDischarge ? (
                <span className="label-mono text-[var(--color-amber)]">DISCHARGE PENDIENTE</span>
              ) : (
                <button
                  disabled={pending}
                  onClick={() => setDischargeMode("leave")}
                  className="btn btn-danger"
                >
                  Abandonar
                </button>
              )
            ) : (
              <button
                disabled={pending}
                onClick={() => start(() => leaveSlot(slot.id))}
                className="btn"
              >
                Salir
              </button>
            )
          ) : slot.holder ? (
            <span className="label-mono">—</span>
          ) : slot.joinMode === "OPEN" ? (
            blockedFromActing ? (
              <button
                disabled={pending}
                onClick={() => setDischargeMode("switch")}
                className="btn btn-danger"
                title={`Pedir baja de ${blocker!.name} y transferencia a este slot`}
              >
                Pedir transferencia
              </button>
            ) : (
              <button disabled={pending} onClick={() => tryJoin(false)} className="btn btn-primary">
                Unirse
              </button>
            )
          ) : myPending ? (
            <span className="label-mono text-[var(--color-accent)]">PENDING</span>
          ) : blockedFromActing ? (
            <button
              disabled={pending}
              onClick={() => setDischargeMode("switch")}
              className="btn btn-danger"
              title={`Pedir baja de ${blocker!.name} y transferencia a este slot`}
            >
              Pedir transferencia
            </button>
          ) : (
            <button disabled={pending} onClick={() => setApplyOpen(true)} className="btn">
              Solicitar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="label-mono text-[var(--color-danger)] mt-2">{error}</div>
      )}

      {warn && (
        <div className="border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-3 mt-3 text-xs font-mono">
          <div>{warn}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => tryJoin(true)} className="btn btn-primary">Confirmar y cambiar</button>
            <button onClick={() => setWarn(null)} className="btn">Cancelar</button>
          </div>
        </div>
      )}

      {applyOpen && (
        <div className="border border-[var(--color-border)] p-3 mt-3 space-y-2">
          <textarea
            value={applyMsg}
            onChange={(e) => setApplyMsg(e.target.value)}
            placeholder="¿Por qué este slot? (opcional)"
            rows={3}
            className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setApplyOpen(false)} className="btn">Cancelar</button>
            <button disabled={pending} onClick={submitApplication} className="btn btn-primary">Enviar solicitud</button>
          </div>
        </div>
      )}

      <HonorableDischargeModal
        open={dischargeMode !== null}
        fromTeamId={dischargeMode === "switch" && blocker ? blocker.id : team.id}
        fromTeamName={dischargeMode === "switch" && blocker ? blocker.name : team.name}
        toSlotId={dischargeMode === "switch" ? slot.id : undefined}
        toTeamName={dischargeMode === "switch" ? team.name : undefined}
        onClose={() => setDischargeMode(null)}
      />
    </div>
  );
}
