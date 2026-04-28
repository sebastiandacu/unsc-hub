"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleLockThread, deleteThread, togglePinThread } from "@/lib/actions/wall";

export function ThreadActions({
  threadId,
  categorySlug,
  locked,
  pinned,
  isAdmin,
  canEdit,
}: {
  threadId: string;
  categorySlug: string;
  locked: boolean;
  pinned: boolean;
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2 justify-end">
      {canEdit && (
        <Link href={`/wall/${categorySlug}/${threadId}/edit`} className="btn">Editar</Link>
      )}
      {isAdmin && (
        <>
          <button disabled={pending} onClick={() => start(() => togglePinThread(threadId))} className="btn">
            {pinned ? "Desfijar" : "Fijar"}
          </button>
          <button disabled={pending} onClick={() => start(() => toggleLockThread(threadId))} className="btn">
            {locked ? "Desbloquear" : "Bloquear"}
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm("¿Eliminar este hilo y todas sus respuestas? No se puede deshacer.")) {
                start(() => deleteThread(threadId));
              }
            }}
            className="btn btn-danger"
          >
            Eliminar
          </button>
        </>
      )}
    </div>
  );
}
