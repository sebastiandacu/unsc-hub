import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { UserRow } from "./UserRow";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
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
            isSelf={u.id === admin.id}
            medalTemplates={medalTemplates}
            patchTemplates={patchTemplates}
          />
        ))}
      </div>
    </>
  );
}
