import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { RosterGrid } from "./RosterGrid";

type RosterUser = {
  id: string;
  nickname: string | null;
  discordUsername: string | null;
  avatarUrl: string | null;
  permission: string;
};

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "tree" ? "tree" : "grid";

  let users: RosterUser[] = [];
  try {
    users = await prisma.user.findMany({
      where: { banned: false, lastSeenAt: { not: null } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, nickname: true, discordUsername: true, avatarUrl: true, permission: true },
    });
  } catch {
    users = [];
  }

  return (
    <>
      <PageHeader
        eyebrow="PERSONAL"
        title="Roster."
        description="Operadores registrados. Cambiá entre vista general (GRID) y vista por equipo (TREE)."
        stamps={[
          { label: `▸ ${users.length} ${users.length === 1 ? "AUTORIZADO" : "AUTORIZADOS"}`, tone: "green" },
        ]}
      />
      <div className="px-7 pb-7 space-y-5">
        <div className="flex items-center gap-1.5 w-fit">
          <ViewTab href="/roster?view=grid" label="GRID" active={view === "grid"} />
          <ViewTab href="/roster?view=tree" label="TREE" active={view === "tree"} />
        </div>

        {users.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-muted)] font-mono">
            — Sin operativos registrados —
          </div>
        ) : view === "grid" ? (
          <RosterGrid users={users} />
        ) : (
          <TreeView />
        )}
      </div>
    </>
  );
}

function ViewTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`chip ${active ? "chip-active" : ""}`}>
      {label}
    </Link>
  );
}

type TreeTeam = {
  id: string;
  name: string;
  callsign: string | null;
  color: string;
  logoUrl: string | null;
  parentTeamId: string | null;
  slots: {
    id: string;
    title: string;
    roleName: string | null;
    holder: { id: string; nickname: string | null; discordUsername: string | null; avatarUrl: string | null; permission: string } | null;
  }[];
};

async function TreeView() {
  const [teams, allUsers] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ parentTeamId: "asc" }, { name: "asc" }],
      include: {
        slots: {
          orderBy: { sortOrder: "asc" },
          include: {
            holder: {
              select: { id: true, nickname: true, discordUsername: true, avatarUrl: true, permission: true },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { banned: false, lastSeenAt: { not: null } },
      select: { id: true, nickname: true, discordUsername: true, avatarUrl: true, permission: true },
    }),
  ]);

  // Compute UNASSIGNED: users not holding any slot anywhere.
  const heldUserIds = new Set<string>();
  for (const t of teams) for (const s of t.slots) if (s.holder) heldUserIds.add(s.holder.id);
  const unassigned = allUsers.filter((u) => !heldUserIds.has(u.id));

  // Build hierarchy.
  const childrenByParent = new Map<string | null, TreeTeam[]>();
  for (const t of teams) {
    const arr = childrenByParent.get(t.parentTeamId) ?? [];
    arr.push(t as TreeTeam);
    childrenByParent.set(t.parentTeamId, arr);
  }
  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className="space-y-4">
      {roots.map((t) => (
        <TeamBranch key={t.id} team={t} childrenByParent={childrenByParent} depth={0} />
      ))}

      <div className="panel panel-bracket p-4 border-dashed">
        <div className="flex items-center gap-3">
          <span className="size-2.5 bg-[var(--color-muted)]" />
          <span className="label-mono-accent">UNASSIGNED</span>
          <span className="label-mono text-[var(--color-muted)]">{unassigned.length} operativos</span>
        </div>
        {unassigned.length === 0 ? (
          <div className="mt-3 text-xs text-[var(--color-muted)] italic">Todos los operativos tienen asignación.</div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {unassigned.map((u) => (
              <MiniUser key={u.id} u={u} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamBranch({
  team,
  childrenByParent,
  depth,
}: {
  team: TreeTeam;
  childrenByParent: Map<string | null, TreeTeam[]>;
  depth: number;
}) {
  const subteams = childrenByParent.get(team.id) ?? [];
  return (
    <div
      className="panel p-4 space-y-3"
      style={{ marginLeft: depth * 16, borderLeft: `2px solid ${team.color}` }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        {team.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.logoUrl}
            alt=""
            className="size-8 object-contain border border-[var(--color-border)] bg-[var(--color-base)] shrink-0"
          />
        )}
        <Link
          href={`/roster/teams/${team.id}`}
          className="font-mono text-base hover:text-[var(--color-accent)]"
        >
          {team.name}
        </Link>
        {team.callsign && (
          <span className="label-mono-accent">{team.callsign}</span>
        )}
        <span className="label-mono text-[var(--color-muted)]">
          {team.slots.filter((s) => s.holder).length}/{team.slots.length} slots
        </span>
      </div>

      {team.slots.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {team.slots.map((s) => (
            <div
              key={s.id}
              className="border border-[var(--color-border)] p-2 flex items-center gap-2"
            >
              {s.holder ? (
                <Link
                  href={`/roster/${s.holder.id}`}
                  className="flex items-center gap-2 min-w-0 flex-1 hover:text-[var(--color-accent)]"
                >
                  <div className="size-7 border border-[var(--color-border)] overflow-hidden grid place-items-center bg-[var(--color-base)] shrink-0">
                    {s.holder.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.holder.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="font-mono text-[10px]">
                        {(s.holder.nickname ?? s.holder.discordUsername ?? "??").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate">
                      {s.holder.nickname ?? s.holder.discordUsername}
                    </div>
                    <div className="label-mono truncate">
                      {s.title}
                      {s.roleName && <span className="text-[var(--color-accent)] ml-1">· {s.roleName}</span>}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="label-mono text-[var(--color-muted)]">VACANT</div>
                  <div className="label-mono truncate">
                    {s.title}
                    {s.roleName && <span className="text-[var(--color-accent)] ml-1">· {s.roleName}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {subteams.length > 0 && (
        <div className="space-y-3 pt-2">
          {subteams.map((c) => (
            <TeamBranch key={c.id} team={c} childrenByParent={childrenByParent} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function MiniUser({ u }: { u: RosterUser }) {
  return (
    <Link
      href={`/roster/${u.id}`}
      className="border border-[var(--color-border)] p-2 flex items-center gap-2 hover:border-[var(--color-accent)] transition-colors"
    >
      <div className="size-7 border border-[var(--color-border)] overflow-hidden grid place-items-center bg-[var(--color-base)] shrink-0">
        {u.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="font-mono text-[10px]">{(u.nickname ?? u.discordUsername ?? "??").slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-xs truncate">{u.nickname ?? u.discordUsername}</div>
        <div className="label-mono">{u.permission}</div>
      </div>
    </Link>
  );
}
