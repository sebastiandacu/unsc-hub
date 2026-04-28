"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { searchAll, type SearchHit } from "@/lib/actions/search";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  user: "OPERATOR",
  team: "TEAM",
  bulletin: "BULLETIN",
  thread: "THREAD",
};

const KIND_GLYPH: Record<SearchHit["kind"], string> = {
  user: "◉",
  team: "▣",
  bulletin: "▤",
  thread: "▦",
};

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Global Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setHits([]);
      setCursor(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await searchAll(trimmed);
        setHits(res);
        setCursor(0);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(id);
  }, [q, open]);

  function go(hit: SearchHit) {
    setOpen(false);
    router.push(hit.url);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[cursor]) go(hits[cursor]);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 h-9 border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-text)] text-xs font-mono min-w-[180px]"
        title="Buscar (Ctrl+K)"
      >
        <span>⌕</span>
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="text-[9px] border border-[var(--color-border-2)] px-1 py-0.5 leading-none">⌃K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden size-9 grid place-items-center border border-[var(--color-border)] hover:border-[var(--color-accent)]"
        title="Buscar"
      >
        ⌕
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-start pt-[12vh] px-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-xl panel panel-bracket shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--color-border)]">
              <span className="text-[var(--color-accent)] text-lg">⌕</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar operativos, equipos, bulletins, threads..."
                className="flex-1 bg-transparent outline-none text-sm font-mono placeholder:text-[var(--color-muted)]"
              />
              {loading && <span className="label-mono text-[var(--color-muted)]">…</span>}
              <kbd className="text-[10px] border border-[var(--color-border-2)] px-1.5 py-0.5 font-mono leading-none">ESC</kbd>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {hits.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-muted)] font-mono">
                  {q.trim().length < 2
                    ? "Escribí al menos 2 caracteres."
                    : loading
                      ? "Buscando…"
                      : "Sin resultados."}
                </div>
              ) : (
                <ul>
                  {hits.map((h, i) => (
                    <li key={`${h.kind}-${h.id}`}>
                      <button
                        onClick={() => go(h)}
                        onMouseEnter={() => setCursor(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-l-2 transition-colors ${
                          i === cursor
                            ? "bg-[var(--color-panel-2)] border-[var(--color-accent)]"
                            : "border-transparent hover:bg-[var(--color-panel-2)]/50"
                        }`}
                      >
                        <span className="text-[var(--color-accent)] text-sm w-4 text-center">{KIND_GLYPH[h.kind]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-mono truncate">{h.title}</div>
                          {h.subtitle && (
                            <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">{h.subtitle}</div>
                          )}
                        </div>
                        <span className="label-mono text-[8.5px] text-[var(--color-border-2)]">{KIND_LABEL[h.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-[var(--color-border)] px-4 py-2 flex items-center gap-4 text-[9.5px] font-mono uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <span><kbd className="border border-[var(--color-border-2)] px-1 py-0.5">↑↓</kbd> nav</span>
              <span><kbd className="border border-[var(--color-border-2)] px-1 py-0.5">↵</kbd> abrir</span>
              <span className="ml-auto">{hits.length} resultado{hits.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
