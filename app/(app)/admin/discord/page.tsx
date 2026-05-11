import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { listGuildRoles } from "@/lib/actions/discord";
import { DiscordPanel } from "./DiscordPanel";
import { InvitesPanel } from "./InvitesPanel";
import type { DiscordRole } from "@/lib/discord";

export default async function AdminDiscordPage() {
  await requireAdmin();
  const [priorities, invites] = await Promise.all([
    prisma.discordRolePriority.findMany({
      orderBy: { priorityOrder: "asc" },
    }),
    prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { nickname: true, discordUsername: true } },
        _count: { select: { redemptions: true } },
      },
    }),
  ]);

  let roles: DiscordRole[] = [];
  let error: string | null = null;
  try {
    roles = await listGuildRoles();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · DISCORD"
        title="Discord & Invitaciones."
        description="Mapeo de roles a rangos del hub + códigos de invitación para comunidades amigas que no tienen el rol del server."
      />
      <div className="px-7 pb-7 space-y-6">
        <InvitesPanel
          invites={invites.map((i) => ({
            id: i.id,
            code: i.code,
            label: i.label,
            createdByName: i.createdBy.nickname ?? i.createdBy.discordUsername ?? "—",
            createdAt: i.createdAt.toISOString(),
            maxUses: i.maxUses,
            uses: i.uses,
            redemptionCount: i._count.redemptions,
            expiresAt: i.expiresAt?.toISOString() ?? null,
            revoked: i.revoked,
          }))}
        />

        {error && (
          <div className="panel p-4 mb-4 border-[var(--color-danger)]/40 text-[var(--color-danger)] text-sm font-mono">
            No se pudieron obtener los roles del guild: {error}
          </div>
        )}
        <DiscordPanel roles={roles} priorities={priorities} />
      </div>
    </>
  );
}
