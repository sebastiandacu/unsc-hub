import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { resolveRank } from "@/lib/rank";
import { PromotionHistory } from "./PromotionHistory";

export default async function ProfilePage({
  params,
}: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      medals: { orderBy: { awardedAt: "desc" } },
      patches: { orderBy: { awardedAt: "desc" } },
      heldSlots: {
        include: { team: { select: { id: true, name: true, callsign: true, color: true } } },
      },
    },
  });
  if (!user) notFound();

  const rank = await resolveRank(user.id);

  return (
    <>
      <PageHeader
        eyebrow="// Personnel File"
        title={user.nickname ?? user.discordUsername ?? "Operativo"}
        description={user.discordUsername ? `@${user.discordUsername}` : undefined}
      />
      <div className="p-8 grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Left — ID card */}
        <div className="panel panel-bracket p-4 h-fit">
          <div className="aspect-square bg-[var(--color-base)] border border-[var(--color-border)] grid place-items-center overflow-hidden relative">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-display text-4xl text-[var(--color-muted)]" style={{ fontFamily: "var(--font-display)" }}>
                {(user.nickname ?? user.discordUsername ?? "??").slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between label-mono text-[8.5px]">
              <span className="bg-black/70 px-1.5 py-0.5">ID · {user.id.slice(-6).toUpperCase()}</span>
              <span className={`px-1.5 py-0.5 ${user.permission === "ADMIN" ? "bg-[var(--color-danger)]/80 text-white" : "bg-black/70 text-[var(--color-accent)]"}`}>
                {user.permission}
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs font-mono">
            <Row k="Rango"        v={<span className="text-[var(--color-accent)]">{rank.label}</span>} />
            <Row k="Permiso"      v={user.permission} />
            <Row k="Discord"      v={user.discordUsername ? `@${user.discordUsername}` : "—"} />
            <Row k="Medals"       v={user.medals.length} />
            <Row k="Parches"      v={user.patches.length} />
            <Row k="Equipos"      v={user.heldSlots.length} />
            <Row k="Reclutado"    v={new Date(user.createdAt).toLocaleDateString("es-ES")} />
            {user.lastSeenAt && (
              <Row k="Última vez" v={new Date(user.lastSeenAt).toLocaleDateString("es-ES")} />
            )}
          </div>
        </div>

        {/* Right — dossier */}
        <div className="space-y-6">
          <section className="panel p-5">
            <div className="label-mono">Bio</div>
            <p className="mt-2 text-sm text-[var(--color-text)]/90 whitespace-pre-line leading-relaxed">
              {user.bio || <span className="text-[var(--color-muted)] italic">(Sin biografía registrada.)</span>}
            </p>
          </section>

          <section className="panel p-5">
            <div className="label-mono flex items-center justify-between">
              <span>Assigned Teams</span>
              <span className="text-[var(--color-muted)]">{user.heldSlots.length} slots</span>
            </div>
            {user.heldSlots.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-muted)]">Sin asignaciones activas.</p>
            ) : (
              <ul className="mt-3 grid sm:grid-cols-2 gap-3">
                {user.heldSlots.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/roster/teams/${s.team.id}`}
                      className="block border border-[var(--color-border)] p-3 hover:border-[var(--color-accent)] transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: s.team.color, boxShadow: `0 0 8px ${s.team.color}80` }} />
                        {s.team.callsign && <span className="label-mono-accent">{s.team.callsign}</span>}
                      </div>
                      <div className="font-mono text-sm mt-2 group-hover:text-[var(--color-accent)] transition-colors">
                        {s.team.name}
                      </div>
                      <div className="label-mono mt-1 text-[var(--color-muted)]">
                        {s.title}
                        {s.roleName && <span className="text-[var(--color-accent)] ml-2">· {s.roleName}</span>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <div className="label-mono flex items-center justify-between">
              <span>Medals & Commendations</span>
              <span className="text-[var(--color-muted)]">{user.medals.length}</span>
            </div>
            {user.medals.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-muted)]">Sin condecoraciones.</p>
            ) : (
              <ul className="mt-3 grid sm:grid-cols-2 gap-3">
                {user.medals.map((m) => (
                  <li key={m.id} className="border border-[var(--color-border)] p-3 flex gap-3">
                    {m.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.iconUrl} alt="" className="size-10 object-contain shrink-0" />
                    ) : (
                      <div className="size-10 shrink-0 border border-[var(--color-accent)]/40 grid place-items-center text-[var(--color-accent)] font-mono text-sm">
                        ★
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-sm truncate">{m.name}</div>
                      {m.description && <div className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2">{m.description}</div>}
                      <div className="label-mono mt-1 text-[var(--color-muted)]">
                        {new Date(m.awardedAt).toLocaleDateString("es-ES")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <div className="label-mono flex items-center justify-between">
              <span>Patches Collection</span>
              <span className="text-[var(--color-muted)]">{user.patches.length}</span>
            </div>
            {user.patches.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-muted)]">Sin parches coleccionados.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {user.patches.map((p) => (
                  <li key={p.id} className="border border-[var(--color-border)] p-2 text-center group hover:border-[var(--color-accent)] transition-colors">
                    <div className="aspect-square bg-[var(--color-base)] grid place-items-center overflow-hidden">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.name} className="size-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <span className="font-display text-2xl text-[var(--color-muted)]" style={{ fontFamily: "var(--font-display)" }}>▣</span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] mt-2 break-words" title={p.name}>{p.name}</div>
                    {p.description && (
                      <div className="label-mono text-[var(--color-muted)] mt-0.5 break-words whitespace-normal leading-relaxed" title={p.description}>{p.description}</div>
                    )}
                    <div className="label-mono mt-1 text-[var(--color-muted)]">
                      {new Date(p.awardedAt).toLocaleDateString("es-ES")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <PromotionHistory userId={user.id} />

          <div className="panel p-4">
            <Link href="/roster" className="label-mono hover:text-[var(--color-accent)]">← Roster completo</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--color-border)] pb-1">
      <span className="text-[var(--color-muted)]">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}
