"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { JoinMode, TeamType } from "@prisma/client";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  createSlot,
  updateSlot,
  deleteSlot,
  reviewApplication,
  adminKickFromSlot,
  adminAssignToSlot,
  adminBanFromTeam,
  adminUnbanFromTeam,
} from "@/lib/actions/teams";
import {
  createTeamCategory,
  updateTeamCategory,
  deleteTeamCategory,
  fetchGuildRoles,
} from "@/lib/actions/teamCategories";
import { ImageUploadButton } from "@/components/ImageUploadButton";

type SlotInfo = {
  id: string;
  title: string;
  roleName: string | null;
  joinMode: JoinMode;
  minRankPriority: number | null;
  holderId: string | null;
  holderName: string | null;
};

type BanInfo = {
  userId: string;
  userName: string;
  reason: string | null;
  bannedByName: string;
  createdAt: string;
};

type TeamInfo = {
  id: string;
  name: string;
  callsign: string | null;
  color: string;
  logoUrl: string | null;
  description: string | null;
  allowsMultiMembership: boolean;
  minRankPriority: number | null;
  teamType: TeamType;
  categoryId: string | null;
  slots: SlotInfo[];
  bans: BanInfo[];
};

type CategoryInfo = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  logoUrl: string | null;
  sortOrder: number;
  teamCount: number;
  shoutAuthorizedRoleIds: string[];
  discordRoleId: string | null;
};

type Priority = { priorityOrder: number; displayLabel: string };

type Application = {
  id: string;
  applicantId: string;
  applicantName: string;
  slotTitle: string;
  teamId: string;
  teamName: string;
  message: string | null;
  createdAt: Date;
};

type UserOption = { id: string; name: string };

export function TeamsAdmin({
  teams,
  applications,
  users,
  priorities,
  categories,
}: {
  teams: TeamInfo[];
  applications: Application[];
  users: UserOption[];
  priorities: Priority[];
  categories: CategoryInfo[];
}) {
  const [pending, start] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const rankMap = useMemo(
    () => Object.fromEntries(priorities.map((p) => [p.priorityOrder, p.displayLabel])) as Record<number, string>,
    [priorities],
  );

  return (
    <>
      {applications.length > 0 && (
        <section className="panel p-5">
          <h2 className="font-mono uppercase text-sm tracking-[0.16em] mb-3">
            Solicitudes Pendientes ({applications.length})
          </h2>
          <ul className="space-y-2">
            {applications.map((a) => (
              <li key={a.id} className="border border-[var(--color-border)] p-3 flex flex-wrap items-center gap-3">
                <Link href={`/roster/${a.applicantId}`} className="font-mono text-sm hover:text-[var(--color-accent)]">
                  {a.applicantName}
                </Link>
                <span className="label-mono">→ {a.teamName} / {a.slotTitle}</span>
                {a.message && <span className="text-xs text-[var(--color-muted)] flex-1">"{a.message}"</span>}
                <span className="label-mono">{new Date(a.createdAt).toLocaleDateString()}</span>
                <button disabled={pending} onClick={() => start(() => reviewApplication(a.id, true))} className="btn btn-primary">Aprobar</button>
                <button disabled={pending} onClick={() => { setRejecting(a); setRejectNote(""); }} className="btn">Rechazar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CategoriesSection categories={categories} pending={pending} start={start} />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono uppercase text-sm tracking-[0.16em]">Equipos ({teams.length})</h2>
          <button
            onClick={() => setCreateOpen(!createOpen)}
            disabled={categories.length === 0}
            title={categories.length === 0 ? "Creá una categoría primero." : ""}
            className="btn"
          >
            {createOpen ? "Cancelar" : "+ Nuevo equipo"}
          </button>
        </div>

        {createOpen && (
          <TeamForm
            priorities={priorities}
            categories={categories}
            onSubmit={(data) => start(async () => {
              await createTeam(data);
              setCreateOpen(false);
            })}
            pending={pending}
          />
        )}

        <div className="space-y-3 mt-4">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} pending={pending} start={start} users={users} priorities={priorities} rankMap={rankMap} categories={categories} />
          ))}
          {teams.length === 0 && !createOpen && (
            <div className="panel p-8 text-center text-[var(--color-muted)]">Sin equipos todavía.</div>
          )}
        </div>
      </section>

      {rejecting && mounted && createPortal(
        <div
          className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => !pending && setRejecting(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel w-full max-w-lg p-6 space-y-4"
          >
            <div>
              <div className="label-mono text-[var(--color-muted)]">Rechazar solicitud</div>
              <h3 className="font-mono text-lg mt-1">
                {rejecting.applicantName} → {rejecting.teamName} / {rejecting.slotTitle}
              </h3>
            </div>

            {rejecting.message && (
              <div className="border-l-2 border-[var(--color-border)] pl-3 text-sm text-[var(--color-muted)] italic">
                "{rejecting.message}"
              </div>
            )}

            <div>
              <label className="label-mono block mb-1">Razón del rechazo (opcional)</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                maxLength={500}
                autoFocus
                placeholder="ej. Faltan operaciones completadas. Volvé a postularte después de tres ops más."
                className="w-full bg-[var(--color-base)] border border-[var(--color-border)] px-3 py-2 font-mono text-sm leading-relaxed"
              />
              <div className="label-mono text-right mt-1 text-[var(--color-muted)]">
                {rejectNote.length}/500 · el postulante recibe esta razón en su notificación
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button
                disabled={pending}
                onClick={() => setRejecting(null)}
                className="btn"
              >
                Cancelar
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  const id = rejecting.id;
                  const note = rejectNote;
                  start(async () => {
                    await reviewApplication(id, false, note);
                    setRejecting(null);
                    setRejectNote("");
                  });
                }}
                className="btn btn-danger"
              >
                {pending ? "Enviando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function TeamCard({
  team,
  pending,
  start,
  users,
  priorities,
  rankMap,
  categories,
}: {
  team: TeamInfo;
  pending: boolean;
  start: (cb: () => void) => void;
  users: UserOption[];
  priorities: Priority[];
  rankMap: Record<number, string>;
  categories: CategoryInfo[];
}) {
  const [editing, setEditing] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [bansOpen, setBansOpen] = useState(false);

  return (
    <div className="panel">
      <div className="p-4 flex items-center gap-3 border-b border-[var(--color-border)]">
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="size-8 object-contain border border-[var(--color-border)] bg-[var(--color-base)]" />
        ) : (
          <span className="size-3 rounded-full" style={{ background: team.color }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-mono">{team.name} {team.callsign && <span className="label-mono ml-2">{team.callsign}</span>}</div>
          <div className="label-mono mt-1">
            {team.allowsMultiMembership ? "no exclusivo" : "exclusivo"}
            {team.teamType === "OPERATIVE" ? " · operativo" : " · organizacional"}
            {team.minRankPriority !== null && ` · rango mín ${rankMap[team.minRankPriority] ?? `#${team.minRankPriority}`}`}
            {team.bans.length > 0 && ` · ${team.bans.length} baneados`}
          </div>
        </div>
        <button onClick={() => setBansOpen(!bansOpen)} className="btn">
          Bans ({team.bans.length})
        </button>
        <button onClick={() => setEditing(!editing)} className="btn">{editing ? "Cancelar" : "Editar"}</button>
        <button
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Eliminar "${team.name}" y todos sus slots? Las solicitudes también se borrarán.`)) {
              start(() => deleteTeam(team.id));
            }
          }}
          className="btn btn-danger"
        >Eliminar</button>
      </div>

      {editing && (
        <div className="p-4 border-b border-[var(--color-border)]">
          <TeamForm
            initial={team}
            priorities={priorities}
            categories={categories}
            onSubmit={(data) => start(async () => {
              await updateTeam(team.id, data);
              setEditing(false);
            })}
            pending={pending}
          />
        </div>
      )}

      {bansOpen && (
        <div className="p-4 border-b border-[var(--color-border)] space-y-3">
          <div className="label-mono">Bans del equipo</div>
          {team.bans.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] font-mono">Sin bans activos.</div>
          ) : (
            <ul className="space-y-1">
              {team.bans.map((b) => (
                <li key={b.userId} className="flex items-center gap-3 border border-[var(--color-border)] px-3 py-2 text-xs font-mono">
                  <span className="flex-1 truncate">{b.userName}</span>
                  {b.reason && <span className="text-[var(--color-muted)] flex-1 truncate">"{b.reason}"</span>}
                  <span className="label-mono">por {b.bannedByName}</span>
                  <button
                    disabled={pending}
                    onClick={() => start(() => adminUnbanFromTeam(team.id, b.userId))}
                    className="label-mono text-[var(--color-accent)] hover:underline"
                  >desbanear</button>
                </li>
              ))}
            </ul>
          )}
          <BanForm
            users={users}
            existingBanIds={new Set(team.bans.map((b) => b.userId))}
            onSubmit={(userId, reason) => start(() => adminBanFromTeam(team.id, userId, reason))}
            pending={pending}
          />
        </div>
      )}

      <div className="p-4 space-y-2">
        {team.slots.length === 0 ? (
          <div className="text-xs text-[var(--color-muted)] font-mono">Sin slots configurados.</div>
        ) : (
          team.slots.map((s) => (
            <SlotRow key={s.id} slot={s} team={team} pending={pending} start={start} users={users} rankMap={rankMap} priorities={priorities} />
          ))
        )}

        <button onClick={() => setSlotOpen(!slotOpen)} className="btn">{slotOpen ? "Cancelar" : "+ Añadir slot"}</button>

        {slotOpen && (
          <SlotForm
            teamId={team.id}
            nextSort={team.slots.length}
            team={team}
            priorities={priorities}
            onSubmit={(data) => start(async () => {
              await createSlot(data);
              setSlotOpen(false);
            })}
            pending={pending}
          />
        )}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  team,
  pending,
  start,
  users,
  rankMap,
  priorities,
}: {
  slot: SlotInfo;
  team: TeamInfo;
  pending: boolean;
  start: (cb: () => void) => void;
  users: UserOption[];
  rankMap: Record<number, string>;
  priorities: Priority[];
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(slot.title);
  const [editRole, setEditRole] = useState(slot.roleName ?? "");
  const [editMode, setEditMode] = useState<JoinMode>(slot.joinMode);
  const [editMin, setEditMin] = useState<string>(slot.minRankPriority?.toString() ?? "");

  return (
    <div className="border border-[var(--color-border)] px-3 py-2 text-xs font-mono space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="truncate">{slot.title}</span>
          {slot.roleName && (
            <span className="label-mono ml-2 text-[var(--color-accent)]">{slot.roleName}</span>
          )}
        </div>
        <span className="label-mono">{slot.joinMode}</span>
        {slot.minRankPriority !== null && <span className="label-mono">mín {rankMap[slot.minRankPriority] ?? `#${slot.minRankPriority}`}</span>}
        <span className="label-mono">{slot.holderName ?? "vacante"}</span>
        {slot.holderId ? (
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`¿Expulsar a ${slot.holderName} de "${slot.title}"?`)) {
                start(() => adminKickFromSlot(slot.id));
              }
            }}
            className="label-mono text-[var(--color-danger)] hover:underline"
          >expulsar</button>
        ) : (
          <button
            onClick={() => setAssignOpen(!assignOpen)}
            className="label-mono text-[var(--color-accent)] hover:underline"
          >{assignOpen ? "cancelar" : "asignar"}</button>
        )}
        <button
          onClick={() => setEditOpen(!editOpen)}
          className="label-mono hover:text-[var(--color-accent)]"
        >{editOpen ? "cerrar" : "editar"}</button>
        <button
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Eliminar slot "${slot.title}"?`)) start(() => deleteSlot(slot.id));
          }}
          className="label-mono text-[var(--color-danger)] hover:underline"
        >borrar</button>
      </div>

      {editOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await updateSlot(slot.id, {
                title: editTitle.trim() || slot.title,
                roleName: editRole.trim() || null,
                joinMode: editMode,
                minRankPriority: editMin === "" ? null : Number(editMin),
              });
              setEditOpen(false);
            });
          }}
          className="grid sm:grid-cols-[1.5fr_1.5fr_1fr_1fr_auto] gap-2 pt-2 border-t border-[var(--color-border)]"
        >
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Callsign del slot"
            className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
          />
          <input
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            placeholder="Rol (ej. Team Leader)"
            className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
          />
          <select
            value={editMode}
            onChange={(e) => setEditMode(e.target.value as JoinMode)}
            className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
          >
            <option value="OPEN">OPEN</option>
            <option value="APPLY">APPLY</option>
          </select>
          <select
            value={editMin}
            onChange={(e) => setEditMin(e.target.value)}
            className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
          >
            <option value="">— sin rango mín —</option>
            {priorities.map((p) => (
              <option key={p.priorityOrder} value={p.priorityOrder}>
                {p.priorityOrder} · {p.displayLabel}
              </option>
            ))}
          </select>
          <button disabled={pending} className="btn btn-primary">Guardar</button>
        </form>
      )}

      {assignOpen && !slot.holderId && (
        <AssignForm
          users={users}
          bannedIds={new Set(team.bans.map((b) => b.userId))}
          onSubmit={(userId) => start(async () => {
            try {
              await adminAssignToSlot(slot.id, userId);
              setAssignOpen(false);
            } catch (err) {
              alert(err instanceof Error ? err.message : String(err));
            }
          })}
          pending={pending}
        />
      )}
    </div>
  );
}

function AssignForm({
  users,
  bannedIds,
  onSubmit,
  pending,
}: {
  users: UserOption[];
  bannedIds: Set<string>;
  onSubmit: (userId: string) => void;
  pending: boolean;
}) {
  const [userId, setUserId] = useState("");
  const available = useMemo(() => users.filter((u) => !bannedIds.has(u.id)), [users, bannedIds]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!userId) return;
        onSubmit(userId);
        setUserId("");
      }}
      className="flex gap-2"
    >
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="flex-1 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      >
        <option value="">— seleccionar operativo —</option>
        {available.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <button disabled={pending || !userId} className="btn btn-primary">Asignar</button>
    </form>
  );
}

function BanForm({
  users,
  existingBanIds,
  onSubmit,
  pending,
}: {
  users: UserOption[];
  existingBanIds: Set<string>;
  onSubmit: (userId: string, reason: string) => void;
  pending: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const available = useMemo(() => users.filter((u) => !existingBanIds.has(u.id)), [users, existingBanIds]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!userId) return;
        onSubmit(userId, reason);
        setUserId("");
        setReason("");
      }}
      className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 text-xs font-mono"
    >
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      >
        <option value="">— banear operativo —</option>
        {available.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      />
      <button disabled={pending || !userId} className="btn btn-danger">Banear</button>
    </form>
  );
}

function TeamForm({
  initial,
  priorities,
  categories,
  onSubmit,
  pending,
}: {
  initial?: TeamInfo;
  priorities: Priority[];
  categories: CategoryInfo[];
  onSubmit: (data: {
    name: string;
    callsign: string | null;
    color: string;
    logoUrl: string | null;
    description: string | null;
    allowsMultiMembership: boolean;
    minRankPriority: number | null;
    teamType: TeamType;
    categoryId: string;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [callsign, setCallsign] = useState(initial?.callsign ?? "");
  const [color, setColor] = useState(initial?.color ?? "#c9a227");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [multi, setMulti] = useState(initial?.allowsMultiMembership ?? false);
  const [minRank, setMinRank] = useState<string>(initial?.minRankPriority?.toString() ?? "");
  const [teamType, setTeamType] = useState<TeamType>(initial?.teamType ?? "ORGANIZATIONAL");
  const [categoryId, setCategoryId] = useState<string>(
    initial?.categoryId ?? categories[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (!categoryId) {
          setError("Tenés que crear y elegir una categoría primero.");
          return;
        }
        setError(null);
        onSubmit({
          name: name.trim(),
          callsign: callsign.trim() || null,
          color: color.trim() || "#c9a227",
          logoUrl: logoUrl.trim() || null,
          description: description.trim() || null,
          allowsMultiMembership: multi,
          minRankPriority: minRank === "" ? null : Number(minRank),
          teamType,
          categoryId,
        });
      }}
      className="grid sm:grid-cols-2 gap-3 text-xs font-mono"
    >
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="sm:col-span-2 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      >
        {categories.length === 0 ? (
          <option value="">— Crear una categoría primero —</option>
        ) : (
          categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))
        )}
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1" />
      <input value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="Callsign (ej. Alpha 1)" className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1" />
      <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color (#hex)" className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1" />
      <select
        value={minRank}
        onChange={(e) => setMinRank(e.target.value)}
        className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      >
        <option value="">Rango mínimo — ninguno</option>
        {priorities.map((p) => (
          <option key={p.priorityOrder} value={p.priorityOrder}>
            {p.priorityOrder} · {p.displayLabel}
          </option>
        ))}
      </select>
      <select
        value={teamType}
        onChange={(e) => setTeamType(e.target.value as TeamType)}
        className="sm:col-span-2 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      >
        <option value="ORGANIZATIONAL">ORGANIZATIONAL — primer slot = (callsign) Actual</option>
        <option value="OPERATIVE">OPERATIVE — slots numerados directos (-1, -2, -3)</option>
      </select>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" rows={3} className="sm:col-span-2 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1" />
      <div className="sm:col-span-2 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-14 object-contain border border-[var(--color-border)] bg-[var(--color-base)]" />
        ) : (
          <div className="size-14 grid place-items-center border border-dashed border-[var(--color-border)] text-[var(--color-muted)] label-mono">LOGO</div>
        )}
        <ImageUploadButton
          endpoint="teamLogo"
          label={logoUrl ? "Cambiar logo" : "Subir logo"}
          onUploaded={(url) => setLogoUrl(url)}
        />
        {logoUrl && (
          <button type="button" onClick={() => setLogoUrl("")} className="label-mono text-[var(--color-danger)] hover:underline">
            quitar
          </button>
        )}
      </div>
      <label className="flex items-start gap-2 sm:col-span-2 cursor-pointer">
        <input
          type="checkbox"
          checked={multi}
          onChange={(e) => setMulti(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <div>No exclusivo (el operativo puede estar en este equipo y en otros simultáneamente)</div>
          <div className="text-[10.5px] text-[var(--color-text-dim)] normal-case tracking-normal mt-0.5 leading-relaxed">
            Si lo dejás sin tildar (exclusivo), unirse a este equipo libera al operativo de cualquier otro equipo donde estuviera (con confirmación).
          </div>
        </span>
      </label>
      {error && (
        <div className="sm:col-span-2 label-mono text-[var(--color-danger)]">{error}</div>
      )}
      <button disabled={pending || !name.trim() || !categoryId} className="btn btn-primary sm:col-span-2 justify-center">
        {pending ? "Guardando..." : initial ? "Guardar cambios" : "Crear equipo"}
      </button>
    </form>
  );
}

function SlotForm({
  teamId,
  nextSort,
  team,
  priorities,
  onSubmit,
  pending,
}: {
  teamId: string;
  nextSort: number;
  team: TeamInfo;
  priorities: Priority[];
  onSubmit: (data: {
    teamId: string;
    title?: string | null;
    roleName?: string | null;
    joinMode: JoinMode;
    minRankPriority: number | null;
    sortOrder: number;
    autoName?: boolean;
  }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [roleName, setRoleName] = useState("");
  const [mode, setMode] = useState<JoinMode>("OPEN");
  const [minRank, setMinRank] = useState("");
  const [autoName, setAutoName] = useState(true);

  const base = team.callsign?.trim() || team.name;
  const count = team.slots.length;
  const previewName =
    team.teamType === "ORGANIZATIONAL"
      ? count === 0
        ? `${base} Actual`
        : `${base}-${count}`
      : `${base}-${count + 1}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!autoName && !title.trim()) return;
        onSubmit({
          teamId,
          title: autoName ? null : title.trim(),
          roleName: roleName.trim() || null,
          joinMode: mode,
          minRankPriority: minRank === "" ? null : Number(minRank),
          sortOrder: nextSort,
          autoName,
        });
        setTitle("");
        setRoleName("");
        setMinRank("");
      }}
      className="border border-[var(--color-border)] p-3 space-y-2 text-xs font-mono"
    >
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={autoName} onChange={(e) => setAutoName(e.target.checked)} />
        Callsign automático <span className="text-[var(--color-muted)]">→ “{previewName}”</span>
      </label>
      <div className="grid sm:grid-cols-[1.3fr_1.3fr_1fr_1fr_auto] gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={autoName ? `Callsign (auto: ${previewName})` : "Callsign manual"}
          disabled={autoName}
          className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
        />
        <input
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          placeholder="Rol (ej. Team Leader)"
          className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
        />
        <select value={mode} onChange={(e) => setMode(e.target.value as JoinMode)} className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1">
          <option value="OPEN">OPEN</option>
          <option value="APPLY">APPLY</option>
        </select>
        <select
          value={minRank}
          onChange={(e) => setMinRank(e.target.value)}
          className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
        >
          <option value="">Rango — ninguno</option>
          {priorities.map((p) => (
            <option key={p.priorityOrder} value={p.priorityOrder}>
              {p.priorityOrder} · {p.displayLabel}
            </option>
          ))}
        </select>
        <button disabled={pending || (!autoName && !title.trim())} className="btn">Añadir</button>
      </div>
    </form>
  );
}

// ============================================================
// CATEGORÍAS — top-level CRUD (create/edit/delete + logo + color)
// ============================================================
function CategoriesSection({
  categories,
  pending,
  start,
}: {
  categories: CategoryInfo[];
  pending: boolean;
  start: (fn: () => Promise<void> | void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryInfo | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono uppercase text-sm tracking-[0.16em]">
          Categorías ({categories.length})
        </h2>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(!open);
          }}
          className="btn"
        >
          {open && !editing ? "Cancelar" : "+ Nueva categoría"}
        </button>
      </div>

      {open && !editing && (
        <div className="panel-elevated panel-bracket p-4 mb-4">
          <CategoryForm
            pending={pending}
            onSubmit={(data) =>
              start(async () => {
                await createTeamCategory(data);
                setOpen(false);
              })
            }
            onCancel={() => setOpen(false)}
          />
        </div>
      )}

      {editing && (
        <div className="panel-elevated panel-bracket p-4 mb-4">
          <div className="label-mono mb-3">Editando: {editing.name}</div>
          <CategoryForm
            initial={editing}
            pending={pending}
            onSubmit={(data) =>
              start(async () => {
                await updateTeamCategory(editing.id, data);
                setEditing(null);
                setOpen(false);
              })
            }
            onCancel={() => {
              setEditing(null);
              setOpen(false);
            }}
          />
        </div>
      )}

      {categories.length === 0 ? (
        <div className="panel p-6 text-center text-sm text-[var(--color-muted)] font-mono">
          Sin categorías. Creá la primera para poder agregar equipos.
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="panel p-3 flex items-center gap-3"
              style={{ borderLeft: `3px solid ${c.color}` }}
            >
              {c.logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={c.logoUrl}
                  alt=""
                  className="size-9 object-contain border border-[var(--color-border)] bg-[var(--color-base)] shrink-0"
                />
              ) : (
                <div
                  className="size-9 grid place-items-center border border-[var(--color-border)] bg-[var(--color-base)] shrink-0 font-mono text-[10px]"
                  style={{ color: c.color }}
                >
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="font-bold text-sm uppercase truncate"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {c.name}
                </div>
                {c.description && (
                  <div className="label-mono normal-case tracking-normal text-[var(--color-text-dim)] text-[10.5px] truncate">
                    {c.description}
                  </div>
                )}
              </div>
              <span className="label-mono shrink-0">
                {c.teamCount} {c.teamCount === 1 ? "equipo" : "equipos"}
              </span>
              <button
                onClick={() => {
                  setEditing(c);
                  setOpen(true);
                }}
                className="btn"
              >
                Editar
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (c.teamCount > 0) {
                    alert(
                      `No se puede borrar: ${c.teamCount} ${c.teamCount === 1 ? "equipo está" : "equipos están"} en esta categoría. Reasigná primero.`,
                    );
                    return;
                  }
                  if (!confirm(`¿Borrar la categoría "${c.name}"?`)) return;
                  start(async () => {
                    try {
                      await deleteTeamCategory(c.id);
                    } catch (e) {
                      alert(e instanceof Error ? e.message : String(e));
                    }
                  });
                }}
                className="btn btn-danger"
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: CategoryInfo;
  pending: boolean;
  onSubmit: (data: {
    name: string;
    description: string | null;
    color: string;
    logoUrl: string | null;
    sortOrder: number;
    shoutAuthorizedRoleIds: string[];
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#4dd0ff");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [sortOrder, setSortOrder] = useState<string>(
    initial?.sortOrder?.toString() ?? "0",
  );
  const [shoutRoles, setShoutRoles] = useState<string[]>(initial?.shoutAuthorizedRoleIds ?? []);
  const [guildRoles, setGuildRoles] = useState<Array<{ id: string; name: string; color: number }> | null>(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRolesLoading(true);
    setRolesError(null);
    fetchGuildRoles()
      .then((rs) => { if (!cancelled) setGuildRoles(rs); })
      .catch((e) => { if (!cancelled) setRolesError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setRolesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function toggleRole(id: string) {
    setShoutRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          description: description.trim() || null,
          color: color.trim() || "#4dd0ff",
          logoUrl: logoUrl.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          shoutAuthorizedRoleIds: shoutRoles,
        });
      }}
      className="grid sm:grid-cols-2 gap-3 text-xs font-mono"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre (ej. SPECIAL OPERATIONS COMMAND)"
        className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1 sm:col-span-2"
      />
      <input
        value={color}
        onChange={(e) => setColor(e.target.value)}
        placeholder="Color (#hex)"
        className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      />
      <input
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value)}
        placeholder="Orden (menor = primero)"
        className="bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción corta (opcional)"
        rows={2}
        className="sm:col-span-2 bg-[var(--color-base)] border border-[var(--color-border)] px-2 py-1"
      />
      <div className="sm:col-span-2 flex items-center gap-3">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt=""
            className="size-14 object-contain border border-[var(--color-border)] bg-[var(--color-base)]"
          />
        ) : (
          <div className="size-14 grid place-items-center border border-dashed border-[var(--color-border)] text-[var(--color-muted)] label-mono">
            LOGO
          </div>
        )}
        <ImageUploadButton
          endpoint="teamLogo"
          label={logoUrl ? "Cambiar logo" : "Subir logo"}
          onUploaded={(url) => setLogoUrl(url)}
        />
        {logoUrl && (
          <button
            type="button"
            onClick={() => setLogoUrl("")}
            className="label-mono text-[var(--color-danger)] hover:underline"
          >
            quitar
          </button>
        )}
      </div>
      <div className="sm:col-span-2">
        <div className="label-mono mb-2">
          Roles autorizados a shoutear en #shout
        </div>
        <div className="text-[10.5px] text-[var(--color-text-dim)] normal-case tracking-normal mb-2 leading-relaxed">
          Seleccioná los roles de Discord que pueden escribir en el canal #shout. Si no marcás nada, todos los miembros con el rol de la categoría podrán escribir.
        </div>
        {rolesLoading && (
          <div className="label-mono text-[var(--color-muted)]">Cargando roles del server…</div>
        )}
        {rolesError && (
          <div className="label-mono text-[var(--color-danger)] normal-case tracking-normal">
            Error: {rolesError}
          </div>
        )}
        {guildRoles && (
          <div className="max-h-44 overflow-y-auto border border-[var(--color-border)] bg-[var(--color-base)] p-2 grid grid-cols-2 gap-1">
            {guildRoles.map((r) => {
              const checked = shoutRoles.includes(r.id);
              const colorHex = r.color === 0
                ? "var(--color-muted)"
                : `#${r.color.toString(16).padStart(6, "0")}`;
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2 px-1.5 py-1 cursor-pointer hover:bg-[var(--color-panel-2)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(r.id)}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  <span className="size-2 shrink-0" style={{ background: colorHex }} />
                  <span className="truncate normal-case tracking-normal" style={{ color: colorHex }}>
                    {r.name}
                  </span>
                </label>
              );
            })}
            {guildRoles.length === 0 && (
              <div className="label-mono text-[var(--color-muted)] col-span-2">
                Sin roles disponibles. Verificá DISCORD_BOT_TOKEN + DISCORD_GUILD_ID.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <button type="button" onClick={onCancel} className="btn">
          Cancelar
        </button>
        <button
          disabled={pending || !name.trim()}
          className="btn btn-primary"
        >
          {pending ? "Guardando..." : initial ? "Guardar cambios" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}


