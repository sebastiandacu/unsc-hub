import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";

export default async function AuditPage() {
  let logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>> = [];
  try {
    logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: true },
    } as never);
  } catch {
    logs = [];
  }
  return (
    <>
      <PageHeader eyebrow="// Admin" title="Audit Log" description="Registro de acciones administrativas." />
      <div className="p-8">
        {logs.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-muted)]">Sin entradas de auditoría todavía.</div>
        ) : (
          <table className="w-full font-mono text-xs">
            <thead className="text-left text-[var(--color-muted)]">
              <tr><th className="py-2">Fecha</th><th>Actor</th><th>Acción</th><th>Objetivo</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-[var(--color-border)]">
                  <td className="py-2">{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{(l as { actor?: { nickname?: string; discordUsername?: string } }).actor?.nickname ?? "—"}</td>
                  <td>{l.action}</td>
                  <td>{l.targetType}:{l.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
