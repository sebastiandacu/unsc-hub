import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Initial notifications snapshot for the bell (cached per request via getCurrentUser).
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <AppShell
      user={{ nickname: user.nickname, discordUsername: user.discordUsername, avatarUrl: user.avatarUrl }}
      isAdmin={user.permission === "ADMIN"}
      notifications={{ items, unreadCount }}
    >
      {children}
    </AppShell>
  );
}
