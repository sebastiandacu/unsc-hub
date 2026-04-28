import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { listGuildRoles } from "@/lib/actions/discord";
import { DiscordPanel } from "./DiscordPanel";
import type { DiscordRole } from "@/lib/discord";

export default async function AdminDiscordPage() {
  await requireAdmin();
  const priorities = await prisma.discordRolePriority.findMany({
    orderBy: { priorityOrder: "asc" },
  });

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
        eyebrow="// Admin"
        title="Prioridades de Roles Discord"
        description="Mapea los roles del guild a rangos del hub. Mayor prioridad = más alto. El número más bajo gana."
      />
      <div className="p-8">
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
