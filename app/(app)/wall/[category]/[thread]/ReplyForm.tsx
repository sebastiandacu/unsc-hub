"use client";

import { useState, useTransition } from "react";
import { RichEditor, type RichDoc } from "@/components/editor/RichEditor";
import { postReply } from "@/lib/actions/wall";

const EMPTY: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

export function ReplyForm({ threadId }: { threadId: string }) {
  const [bodyJson, setBodyJson] = useState<RichDoc | null>(EMPTY);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!bodyJson) return;
        setError(null);
        start(async () => {
          try {
            await postReply({ threadId, bodyJson });
            setBodyJson(EMPTY);
            setResetKey((k) => k + 1);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
      }}
      className="panel p-5 space-y-3"
    >
      <label className="label-mono">Responder</label>
      <RichEditor
        key={resetKey}
        value={bodyJson}
        onChange={setBodyJson}
        placeholder="Escribe tu respuesta..."
        imageEndpoint="threadImage"
      />
      {error && <div className="label-mono text-[var(--color-danger)]">{error}</div>}
      <div className="flex justify-end">
        <button disabled={pending} className="btn btn-primary">
          {pending ? "Publicando..." : "Publicar respuesta"}
        </button>
      </div>
    </form>
  );
}
