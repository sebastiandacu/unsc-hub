"use client";

/**
 * Three-knob visibility panel reused by Bulletin + Event composers.
 *
 *   1. postToDiscord  — fire the webhook on create at all
 *   2. pingEveryone   — include @everyone in the Discord post
 *                       (auto-greyed if restricted to teams or if Discord OFF)
 *   3. restrictedTeamIds — if non-empty, only members of those teams can
 *                          see the bulletin/event in HUB lists & by URL
 */
export type TeamOption = {
  id: string;
  name: string;
  callsign: string | null;
  color: string;
  categoryName: string | null;
};

export function VisibilityControls({
  teams,
  postToDiscord,
  pingEveryone,
  restrictedTeamIds,
  onPostToDiscord,
  onPingEveryone,
  onRestrictedTeamIds,
  scopeLabel,
}: {
  teams: TeamOption[];
  postToDiscord: boolean;
  pingEveryone: boolean;
  restrictedTeamIds: string[];
  onPostToDiscord: (v: boolean) => void;
  onPingEveryone: (v: boolean) => void;
  onRestrictedTeamIds: (v: string[]) => void;
  /** "boletín" or "operación" — used in copy. */
  scopeLabel: string;
}) {
  // Group teams by category for the picker.
  const grouped = new Map<string, TeamOption[]>();
  for (const t of teams) {
    const key = t.categoryName ?? "Sin categoría";
    const arr = grouped.get(key) ?? [];
    arr.push(t);
    grouped.set(key, arr);
  }
  const groups = Array.from(grouped.entries());

  function toggleTeam(id: string) {
    if (restrictedTeamIds.includes(id)) {
      onRestrictedTeamIds(restrictedTeamIds.filter((x) => x !== id));
    } else {
      onRestrictedTeamIds([...restrictedTeamIds, id]);
    }
  }

  const restricted = restrictedTeamIds.length > 0;
  const pingDisabled = !postToDiscord || restricted;

  return (
    <section className="panel-elevated panel-bracket p-5 space-y-4">
      <div className="label-mono-accent">// Visibilidad y Discord</div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Toggle
          checked={postToDiscord}
          onChange={onPostToDiscord}
          label="Postear en Discord"
          hint={`Envía el ${scopeLabel} al webhook configurado.`}
        />
        <Toggle
          checked={pingEveryone && !pingDisabled}
          onChange={onPingEveryone}
          disabled={pingDisabled}
          label="Pingear @everyone"
          hint={
            !postToDiscord
              ? "Desactivado porque Discord está apagado."
              : restricted
                ? "Desactivado automáticamente para posts restringidos."
                : "Incluye @everyone en el post de Discord."
          }
        />
      </div>

      <div>
        <div className="label-mono mb-2">
          Restringir a equipos {restricted && <span className="text-[var(--color-accent)]">({restrictedTeamIds.length} seleccionados)</span>}
        </div>
        <div className="text-[10.5px] text-[var(--color-text-dim)] normal-case tracking-normal mb-2 leading-relaxed">
          Vacío = todos los autorizados ven el {scopeLabel}. Seleccionando uno o varios equipos, solo sus miembros (más admins) podrán verlo en el HUB.
        </div>

        {teams.length === 0 ? (
          <div className="label-mono text-[var(--color-muted)]">
            No hay equipos creados. Andá a /admin/teams.
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto border border-[var(--color-border)] bg-[var(--color-base)] p-2 space-y-3">
            {groups.map(([catName, ts]) => (
              <div key={catName}>
                <div className="label-mono mb-1 text-[var(--color-muted)]">{catName}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {ts.map((t) => {
                    const checked = restrictedTeamIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 px-1.5 py-1 cursor-pointer hover:bg-[var(--color-panel-2)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeam(t.id)}
                          style={{ accentColor: "var(--color-accent)" }}
                        />
                        <span
                          className="size-2 shrink-0"
                          style={{ background: t.color }}
                        />
                        <span className="truncate text-[12px] font-mono">
                          {t.name}
                          {t.callsign && (
                            <span className="text-[var(--color-muted)] ml-1.5">
                              [{t.callsign}]
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 px-3 py-2.5 border ${checked && !disabled ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]" : "border-[var(--color-border)]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-[var(--color-accent-dim)]"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--color-accent)" }}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <div className="font-mono text-[12px] uppercase tracking-[0.12em]">{label}</div>
        <div className="text-[10.5px] text-[var(--color-text-dim)] normal-case tracking-normal mt-0.5 leading-relaxed">
          {hint}
        </div>
      </div>
    </label>
  );
}
