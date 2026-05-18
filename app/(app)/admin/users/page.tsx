import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { UserRow } from "./UserRow";

export default async function AdminUsersPage() {
  // Officers get the page too — UserRow hides admin-only fields and the
  // server actions still rank-gate every write, so it's safe to render
  // the whole list for them. They simply can't act on peers/admins.
  const viewer = await requirePermission("OFFICER");
  const [users, medalTemplates, patchTemplates] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ banned: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        nickname: true,
        discordUsername: true,
        avatarUrl: true,
        permission: true,
        banned: true,
        manualRankOverride: true,
        createdAt: true,
        lastSeenAt: true,
        medals: { select: { id: true, name: true, iconUrl: true }, orderBy: { awardedAt: "desc" } },
        patches: { select: { id: true, name: true, imageUrl: true }, orderBy: { awardedAt: "desc" } },
      },
    }),
    prisma.medalTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, iconUrl: true } }),
    prisma.patchTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, imageUrl: true } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="// Admin"
        title="Usuarios"
        description="Promover, degradar, banear, sobrescribir rango, otorgar medallas. Todas las acciones quedan registradas."
      />
      <div className="p-8 space-y-3">
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === viewer.id}
            viewerPermission={viewer.permission}
            medalTemplates={medalTemplates}
            patchTemplates={patchTemplates}
          />
        ))}
      </div>
    </>
  );
}
