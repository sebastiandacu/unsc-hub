import Link from "next/link";
import { prisma } from "@/lib/db";

type LogEntry = {
  id: string;
  action: string;
  createdAt: Date;
  payloadJson: unknown;
  actor: { id: string; nickname: string | null; discordUsername: string | null };
};

export async function PromotionHistory({ userId }: { userId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      targetType: "User",
      targetId: userId,
      action: { in: ["user.setPermission", "user.setRankOverride"] },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { actor: { select: { id: true, nickname: true, discordUsername: true } } },
  });

  return (
    <section className="panel p-5">
      <div className="label-mono flex items-center justify-between">
        <span>Promotion History</span>
        <span className="text-[var(--color-muted)]">{logs.length} cambios</span>
      </div>
      {logs.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-muted)] italic">Sin cambios registrados.</p>
      ) : (
        <ol className="mt-4 relative border-l border-[var(--color-border)] pl-5 space-y-4">
          {logs.map((l) => (
            <li key={l.id} className="relative">
              <span className="absolute -left-[27px] top-1 size-2.5 bg-[var(--color-accent)] border border-[var(--color-base)] shadow-[0_0_0_2px_var(--color-border)]" />
              <Entry log={l as LogEntry} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Entry({ log }: { log: LogEntry }) {
  const actor = log.actor.nickname ?? log.actor.discordUsername ?? "Operativo";
  const date = new Date(log.createdAt).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const payload = (log.payloadJson ?? {}) as { from?: string | null; to?: string | null; permission?: string; value?: string | null };
  const isPerm = log.action === "user.setPermission";

  // Backward-compat: older logs only stored {permission} or {value}, no `from`.
  const from = payload.from ?? null;
  const to = isPerm ? (payload.to ?? payload.permission ?? "?") : (payload.to ?? payload.value ?? null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="label-mono text-[var(--color-accent)]">
          {isPerm ? "PERMISSION" : "RANK OVERRIDE"}
        </span>
        <span className="font-mono text-sm">
          {from ? (
            <>
              <span className="text-[var(--color-muted)]">{from}</span>
              <span className="mx-2 text-[var(--color-accent)]">→</span>
              <span className="text-[var(--color-text)]">{to ?? "—"}</span>
            </>
          ) : (
            <span className="text-[var(--color-text)]">{to ?? "—"}</span>
          )}
        </span>
      </div>
      <div className="label-mono text-[var(--color-muted)]">
        por{" "}
        <Link href={`/roster/${log.actor.id}`} className="text-[var(--color-accent)] hover:underline">
          {actor}
        </Link>{" "}
        · {date}
      </div>
    </div>
  );
}
