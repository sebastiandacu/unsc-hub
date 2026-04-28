"use client";

import { useTransition } from "react";
import { togglePin, deleteBulletin } from "@/lib/actions/bulletin";

export function BulletinActions({ postId, pinned }: { postId: string; pinned: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button disabled={pending} onClick={() => start(() => togglePin(postId))} className="btn">
        {pinned ? "Desfijar" : "Fijar"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("¿Eliminar este bulletin? No se puede deshacer.")) {
            start(() => deleteBulletin(postId));
          }
        }}
        className="btn btn-danger"
      >
        Eliminar
      </button>
    </div>
  );
}
