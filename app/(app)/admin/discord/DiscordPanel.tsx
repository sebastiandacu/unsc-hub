"use client";

import { useState, useTransition } from "react";
import type { DiscordRole } from "@/lib/discord";
import { addPriority, removePriority, resyncAllUsers } from "@/lib/actions/discord";

type Priority = {
  roleId: string;
  displayLabel: string;
  priorityOrder: number;
};

export function DiscordPanel({
  roles,
  priorities: initial,
}: { roles: DiscordRole[]; priorities: Priority[] }) {
  const [priorities, setPriorities] = useState(initial);
  const [pending, start] = useTransition();
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);

  const mappedRoleIds = new Set(priorities.map((p) => p.roleId));
  const unmapped = roles.filter((r) => !mappedRoleIds.has(r.id) && r.name !== "@everyone");
  const nextOrder = priorities.length === 0
    ? 0
    : Math.max(...priorities.map((p) => p.priorityOrder)) + 1;

  function handleAdd(role: DiscordRole) {
    start(async () => {
      await addPriority({ roleId: role.id, displayLabel: role.name, priorityOrder: nextOrder });
      setPriorities([...priorities, { roleId: role.id, displayLabel: role.name, priorityOrder: nextOrder }]);
    });
  }

  function handleRemove(roleId: string) {
    start(async () => {
      await removePriority(roleId);
      setPriorities(priorities.filter((p) => p.roleId !== roleId));
    });
  }

  function handleMove(roleId: string, dir: -1 | 1) {
    const sorted = [...priorities].sort((a, b) => a.priorityOrder - b.priorityOrder);
    const i = sorted.findIndex((p) => p.roleId === roleId);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i];
    const b = sorted[j];
    start(async () => {
      await Promise.all([
        addPriority({ roleId: a.roleId, displayLabel: a.displayLabel, priorityOrder: b.priorityOrder }),
        addPriority({ roleId: b.roleId, displayLabel: b.displayLabel, priorityOrder: a.priorityOrder }),
      ]);
      sorted[i] = { ...a, priorityOrder: b.priorityOrder };
      sorted[j] = { ...b, priorityOrder: a.priorityOrder };
      setPriorities(sorted);
    });
  }

  function handleResync() {
    setResyncMsg(null);
    start(async () => {
      const r = await resyncAllUsers();
      setResyncMsg(`Resincronizados ${r.ok} en el guild, ${r.missing} ausentes (de ${r.total}).`);
    });
  }

  const sorted = [...priorities].sort((a, b) => a.priorityOrder - b.priorityOrder);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono uppercase text-sm tracking-[0.16em]">Escalafón</h2>
          <button onClick={handleResync} disabled={pending} className="btn">Resincronizar usuarios</button>
        </div>
        {resyncMsg && <div className="label-mono mt-2 text-[var(--color-accent)]">{resyncMsg}</div>}

        {sorted.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Ningún rol mapeado aún. Elige uno de la lista de la derecha — arriba = rango más alto.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {sorted.map((p, i) => (
              <li
                key={p.roleId}
                className="flex items-center gap-2 border border-[var(--color-border)] px-3 py-2"
              >
                <span className="label-mono w-6">{i + 1}</span>
                <span className="font-mono text-sm flex-1 truncate">{p.displayLabel}</span>
                <button disabled={pending || i === 0} onClick={() => handleMove(p.roleId, -1)} className="btn px-2">▲</button>
                <button disabled={pending || i === sorted.length - 1} onClick={() => handleMove(p.roleId, 1)} className="btn px-2">▼</button>
                <button disabled={pending} onClick={() => handleRemove(p.roleId)} className="label-mono text-[var(--color-danger)] hover:underline px-2">quitar</button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="font-mono uppercase text-sm tracking-[0.16em]">Roles disponibles</h2>
        {unmapped.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">Todos los roles (excepto @everyone) están mapeados.</p>
        ) : (
          <ul className="mt-4 space-y-1 max-h-[60vh] overflow-y-auto">
            {unmapped.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 border border-[var(--color-border)] px-3 py-2"
              >
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ background: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#444" }}
                />
                <span className="font-mono text-sm flex-1 truncate">{r.name}</span>
                <button disabled={pending} onClick={() => handleAdd(r)} className="btn">Añadir</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
