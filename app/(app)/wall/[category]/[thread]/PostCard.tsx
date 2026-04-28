"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { RichRenderer } from "@/components/editor/RichRenderer";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { updateReply } from "@/lib/actions/wall";

type Author = { id: string; nickname: string | null; discordUsername: string | null };

export function PostCard({
  author,
  createdAt,
  editedAt,
  body,
  reply,
}: {
  author: Author;
  createdAt: Date;
  editedAt: Date | null;
  body: unknown;
  /** When present, this card is a reply that may be edited inline. */
  reply?: { id: string; canEdit: boolean };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RichDoc | null>(body as RichDoc);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <article className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/roster/${author.id}`} className="font-mono text-sm hover:text-[var(--color-accent)]">
          {author.nickname ?? author.discordUsername}
        </Link>
        <div className="flex items-center gap-3">
          <span className="label-mono">{new Date(createdAt).toLocaleString()}</span>
          {editedAt && (
            <span className="label-mono text-[var(--color-muted)]" title={`Editado: ${new Date(editedAt).toLocaleString()}`}>
              · editado
            </span>
          )}
          {reply?.canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="label-mono text-[var(--color-accent)] hover:underline"
            >
              editar
            </button>
          )}
        </div>
      </div>

      {editing && reply ? (
        <div className="mt-3 space-y-3">
          <RichEditor value={draft} onChange={setDraft} placeholder="Edita la respuesta..." imageEndpoint="threadImage" />
          {error && <div className="label-mono text-[var(--color-danger)]">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(body as RichDoc);
                setError(null);
              }}
              className="btn"
            >
              Cancelar
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (!draft) return;
                setError(null);
                start(async () => {
                  try {
                    await updateReply(reply.id, { bodyJson: draft });
                    setEditing(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                });
              }}
              className="btn btn-primary"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3"><RichRenderer doc={body} /></div>
      )}
    </article>
  );
}
