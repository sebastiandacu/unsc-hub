import { requirePermission } from "@/lib/auth/guards";

/**
 * Admin section is shared between ADMIN and OFFICER tiers. Officers only
 * see /admin/users (with destructive controls hidden client-side); every
 * other admin sub-page guards itself with `requireAdmin()` at the top of
 * the page module, so officers hitting them get redirected.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("OFFICER");
  return <>{children}</>;
}
