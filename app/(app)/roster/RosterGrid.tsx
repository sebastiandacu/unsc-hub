"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RosterUser = {
  id: string;
  nickname: string | null;
  discordUsername: string | null;
  avatarUrl: string | null;
  permission: string;
};

const PERMS = ["ALL", "AUTHORIZED", "LICENSED", "CERTIFICATED", "ADMIN"] as const;

export function RosterGrid({ users }: { users: RosterUser[] }) {
  const [q, setQ] = useState("");
  const [perm, setPerm] = useState<(typeof PERMS)[number]>("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (perm !== "ALL" && u.permission !== perm) return false;
      if (!needle) return true;
      const hay = `${u.nickname ?? ""} ${u.discordUsername ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [users, q, perm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="⌕  buscar callsign / @discord ..."
          className="input flex-1 max-w-[360px]"
        />
        <div className="flex flex-1" />
        <div className="flex gap-1.5">
          {PERMS.map((p) => (
            <button
              key={p}
              onClick={() => setPerm(p)}
              className={`chip ${perm === p ? "chip-active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="label-mono shrink-0">
          {filtered.length}/{users.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="panel-elevated panel-bracket p-12 text-center text-[var(--color-muted)] font-mono">
          — Sin coincidencias —
        </div>
      ) : (
        <div
          className="grid gap-3.5 reveal-stagger"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          }}
        >
          {filtered.map((u, i) => (
            <UserCard key={u.id} u={u} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserCard({ u, index }: { u: RosterUser; index: number }) {
  const callsign = u.nickname ?? u.discordUsername ?? "OPERATIVO";
  const tagColor =
    u.permission === "ADMIN"
      ? "var(--color-danger)"
      : u.permission === "CERTIFICATED"
        ? "var(--color-amber)"
        : u.permission === "LICENSED"
          ? "var(--color-success)"
          : "var(--color-accent)";

  return (
    <Link
      href={`/roster/${u.id}`}
      className="relative aspect-[0.78] bg-[var(--color-base-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col overflow-hidden group"
    >
      <span
        className="absolute top-2 left-2 z-[2] font-mono text-[9px] tracking-[0.18em] uppercase border px-1.5 py-0.5"
        style={{
          borderColor: tagColor,
          color: tagColor,
          background: "rgba(0,0,0,0.6)",
        }}
      >
        ● {u.permission}
      </span>
      <span className="absolute top-2 right-2 z-[2] font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--color-muted)]">
        #{String(index + 1).padStart(3, "0")}
      </span>

      <div
        className="flex-1 relative overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(135deg, rgba(77,208,255,0.06) 0, rgba(77,208,255,0.06) 4px, transparent 4px, transparent 10px), linear-gradient(180deg, var(--color-panel-2), var(--color-base-2))",
        }}
      >
        {u.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={u.avatarUrl}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <span
            className="absolute inset-0 grid place-items-center text-2xl text-[var(--color-muted)]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            {callsign.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)",
          }}
        />
      </div>

      <div
        className="px-2.5 py-2 border-t border-[var(--color-border)] bg-[var(--color-base)]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div className="text-[9px] text-[var(--color-muted)] tracking-[0.18em] uppercase">
          {u.discordUsername ? `@${u.discordUsername}` : u.permission}
        </div>
        <div
          className="text-[13px] font-semibold mt-0.5 truncate uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          &quot;<span style={{ color: "var(--color-accent)" }}>{callsign.toUpperCase()}</span>&quot;
        </div>
      </div>
    </Link>
  );
}
