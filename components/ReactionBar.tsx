"use client";

import { useTransition, useState } from "react";
import { toggleReaction } from "@/lib/actions/reactions";
import { ALLOWED_EMOJIS } from "@/lib/reactions";

type ReactionGroup = { emoji: string; count: number; mine: boolean };

export function ReactionBar({
  threadId,
  categorySlug,
  initial,
}: {
  threadId: string;
  categorySlug: string;
  initial: ReactionGroup[];
}) {
  const [groups, setGroups] = useState<ReactionGroup[]>(initial);
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  function applyToggle(emoji: string) {
    // Optimistic
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.emoji === emoji);
      if (idx === -1) return [...prev, { emoji, count: 1, mine: true }];
      const g = prev[idx];
      const next = { ...g, mine: !g.mine, count: g.count + (g.mine ? -1 : 1) };
      const out = [...prev];
      if (next.count <= 0) out.splice(idx, 1);
      else out[idx] = next;
      return out;
    });
    start(async () => {
      try {
        await toggleReaction(threadId, emoji, categorySlug);
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map((g) => (
        <button
          key={g.emoji}
          disabled={pending}
          onClick={() => applyToggle(g.emoji)}
          className={`flex items-center gap-1.5 px-2 py-1 border text-xs font-mono transition-all ${
            g.mine
              ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "border-[var(--color-border)] hover:border-[var(--color-accent)]/60"
          }`}
          title={g.mine ? "Quitar reacción" : "Reaccionar"}
        >
          <span>{g.emoji}</span>
          <span>{g.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="size-7 grid place-items-center border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-muted)] hover:text-[var(--color-accent)] text-xs"
          title="Añadir reacción"
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full mt-1 z-20 panel p-1.5 flex gap-1">
            {ALLOWED_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  applyToggle(e);
                  setPickerOpen(false);
                }}
                className="size-8 grid place-items-center hover:bg-[var(--color-panel-2)] text-base"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
