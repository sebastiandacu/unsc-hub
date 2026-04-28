"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  listMyNotifications,
  markNotificationRead,
  dismissNotification,
  clearAllNotifications,
} from "@/lib/actions/notifications";

type N = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationBell({
  initialItems,
  initialUnread,
}: {
  initialItems: N[];
  initialUnread: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => { setMounted(true); }, []);

  // Anchor portaled panel to the bell button via fixed positioning.
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const compute = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  // Track which notifications were on screen during this open session.
  // When the panel closes, the read ones (and the ones we tagged read on click)
  // get deleted server-side so the inbox truly empties.
  const seenIdsRef = useRef<Set<string>>(new Set());

  async function refresh() {
    const data = await listMyNotifications(20);
    setItems(data.items as unknown as N[]);
    setUnread(data.unreadCount);
  }

  function close() {
    setOpen(false);
    // On close: drop everything the user opened the panel and saw.
    // We only delete items we actually showed in this session — anything
    // that arrived after the open snapshot stays as unread for next time.
    const toDelete = [...seenIdsRef.current];
    seenIdsRef.current = new Set();
    if (toDelete.length === 0) return;
    start(async () => {
      await Promise.all(toDelete.map((id) => dismissNotification(id).catch(() => {})));
      await refresh().catch(() => {});
    });
  }

  // Click outside closes (and triggers cleanup) — accounts for portaled panel.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      const inAnchor = ref.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inAnchor && !inPanel) close();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lightweight polling every 60s while panel is closed
  useEffect(() => {
    const id = setInterval(async () => {
      if (open) return;
      try {
        const data = await listMyNotifications(20);
        setItems(data.items as unknown as N[]);
        setUnread(data.unreadCount);
      } catch {
        /* ignore */
      }
    }, 60000);
    return () => clearInterval(id);
  }, [open]);

  // When the panel opens, tag every item currently on screen as "seen this session".
  useEffect(() => {
    if (!open) return;
    items.forEach((n) => seenIdsRef.current.add(n.id));
  }, [open, items]);

  function onClickItem(n: N) {
    // Optimistic remove
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    if (!n.readAt) setUnread((u) => Math.max(0, u - 1));
    seenIdsRef.current.delete(n.id);
    start(async () => {
      if (!n.readAt) await markNotificationRead(n.id).catch(() => {});
      await dismissNotification(n.id).catch(() => {});
      setOpen(false);
      if (n.url) router.push(n.url);
    });
  }

  function onClearAll() {
    // Optimistic clear
    setItems([]);
    setUnread(0);
    seenIdsRef.current = new Set();
    start(async () => {
      await clearAllNotifications().catch(() => {});
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
            refresh();
          }
        }}
        className="relative size-9 grid place-items-center border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
        title="Notificaciones"
      >
        <span className="text-[14px] leading-none">▣</span>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center bg-[var(--color-accent)] text-black text-[10px] font-mono font-bold">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed w-[360px] panel panel-bracket z-[200] max-h-[70vh] flex flex-col"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="label-mono">Inbox</div>
            <button
              onClick={onClearAll}
              disabled={pending || items.length === 0}
              className="label-mono text-[var(--color-accent)] hover:underline disabled:opacity-30 disabled:no-underline"
            >
              Limpiar todo
            </button>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-border)]">
            {items.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--color-muted)] font-mono">
                — Inbox vacío —
              </div>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className={`flex gap-2.5 ${n.readAt ? "opacity-60" : ""}`}>
                    <span
                      className={`mt-1 size-1.5 shrink-0 rounded-full ${n.readAt ? "bg-[var(--color-border-2)]" : "bg-[var(--color-accent)]"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-mono break-words">{n.title}</div>
                      {n.body && (
                        <div className="text-[11px] text-[var(--color-muted)] mt-0.5 break-words">{n.body}</div>
                      )}
                      <div className="label-mono mt-1 text-[8.5px] text-[var(--color-border-2)]">
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                  </div>
                );
                return n.url ? (
                  <button
                    key={n.id}
                    onClick={() => onClickItem(n)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--color-panel-2)]/60 transition-colors"
                  >
                    {inner}
                  </button>
                ) : (
                  <div key={n.id} className="px-4 py-3">
                    {inner}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[var(--color-border)] px-4 py-2 text-right">
            <Link
              href="/dashboard"
              onClick={close}
              className="label-mono hover:text-[var(--color-accent)]"
            >
              Cerrar →
            </Link>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "ahora";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return date.toLocaleDateString("es-ES");
}
