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
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="label-mono text-[var(--color-muted)] shrink-0">QUERY</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar callsign / @discord..."
            className="flex-1 bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex items-center gap-1">
          {PERMS.map((p) => (
            <button
              key={p}
              onClick={() => setPerm(p)}
              className={`label-mono px-2.5 py-1.5 transition-colors ${
                perm === p
                  ? "bg-[var(--color-accent)] text-black"
                  : "text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="label-mono text-[var(--color-muted)] shrink-0">
          {filtered.length}/{users.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-12 text-center text-[var(--color-muted)] font-mono">
          — Sin coincidencias —
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 reveal-stagger">
          {filtered.map((u, i) => (
            <UserCard key={u.id} u={u} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserCard({ u, index }: { u: RosterUser; index: number }) {
  return (
    <Link
      href={`/roster/${u.id}`}
      className="panel panel-bracket p-3 hover:border-[var(--color-accent)] transition-all group"
    >
      <div className="aspect-square bg-[var(--color-base)] border border-[var(--color-border)] grid place-items-center overflow-hidden relative">
        {u.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatarUrl} alt="" className="size-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <span className="font-display text-3xl text-[var(--color-muted)]" style={{ fontFamily: "var(--font-display)" }}>
            {(u.nickname ?? u.discordUsername ?? "??").slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="absolute top-1.5 left-1.5 label-mono text-[8.5px] text-[var(--color-accent)] bg-black/60 px-1.5 py-0.5">
          №{String(index + 1).padStart(3, "0")}
        </span>
      </div>
      <div className="mt-3 px-1">
        <div className="font-mono text-sm truncate group-hover:text-[var(--color-accent)] transition-colors">
          {u.nickname ?? u.discordUsername}
        </div>
        <div className="label-mono mt-1 flex items-center gap-1.5">
          <span className={`size-1 ${u.permission === "ADMIN" ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent)]"}`} />
          {u.permission}
        </div>
      </div>
    </Link>
  );
}
