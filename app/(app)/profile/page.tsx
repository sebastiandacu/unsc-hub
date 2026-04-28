import { PageHeader } from "@/components/PageHeader";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { resolveRank } from "@/lib/rank";
import { prisma } from "@/lib/db";
import { ProfileEditor } from "./ProfileEditor";

export default async function MyProfilePage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");
  const rank = await resolveRank(user.id);

  const [bulletinCount, eventCount, mySlots] = await Promise.all([
    prisma.bulletinPost.count({ where: { authorId: user.id } }),
    prisma.eventRSVP.count({ where: { userId: user.id } }),
    prisma.teamSlot.findMany({
      where: { holderId: user.id },
      include: { team: { select: { name: true, callsign: true } } },
    }),
  ]);

  const callsign = (user.nickname ?? user.discordUsername ?? "OPERATIVO").toUpperCase();
  const idNumber = user.id.slice(-7).replace(/(.{2})(.+)/, "$1-$2").toUpperCase();
  const accessLevel =
    isAdmin ? 5 : hasPermission(user, "CERTIFICATED") ? 4 : hasPermission(user, "LICENSED") ? 3 : 2;
  const ingreso = new Date(user.createdAt).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const teamLabel = mySlots.length === 0 ? "—" : mySlots.map((s) => s.team.callsign ?? s.team.name).join(", ");

  return (
    <>
      <PageHeader
        eyebrow={`OPERADOR · ${idNumber}`}
        title="Mi Perfil."
        description="Tu ficha personal. Editá callsign, avatar y biografía."
      />

      <div
        className="px-7 pb-7 grid gap-5 reveal-stagger"
        style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)" }}
      >
        {/* === ID Card === */}
        <div className="panel-elevated panel-bracket p-5 relative">
          <div className="flex justify-between items-center mb-3.5">
            <span className="label-mono-accent">// Ficha Operativa</span>
            <span className="stamp">NIVEL {accessLevel}</span>
          </div>

          <div
            className="relative aspect-[1.05/1] border border-[var(--color-border-2)] grid place-items-center overflow-hidden mb-4"
            style={{
              background:
                "repeating-linear-gradient(135deg, rgba(77,208,255,0.04) 0, rgba(77,208,255,0.04) 6px, transparent 6px, transparent 12px), linear-gradient(180deg, var(--color-panel-2), var(--color-base-2))",
            }}
          >
            {user.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatarUrl} alt={callsign} className="size-full object-cover" />
            ) : (
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--color-muted)] bg-[var(--color-base-2)] px-3 py-1 border border-dashed border-[var(--color-border-2)]">
                ▸ Sin foto
              </span>
            )}
          </div>

          <div className="font-mono text-[10px] text-[var(--color-muted)] tracking-[0.2em]">
            #{idNumber} · INGRESO {ingreso}
          </div>
          <div
            className="mt-1 uppercase font-bold text-[26px] leading-none tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {rank.label.split(" ")[0] || "OP."}{" "}
            <span style={{ color: "var(--color-accent)" }}>&quot;{callsign}&quot;</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="stamp">▸ AUTORIZADO</span>
            {hasPermission(user, "LICENSED") && <span className="stamp stamp-green">▸ LICENCIA</span>}
            {hasPermission(user, "CERTIFICATED") && <span className="stamp stamp-green">▸ CERTIFICADO</span>}
            {isAdmin && <span className="stamp stamp-amber">▸ ADMIN</span>}
          </div>

          <hr className="hr my-4" />

          <div className="grid grid-cols-2 gap-3">
            <Row k="DISCORD" v={user.discordUsername ? `@${user.discordUsername}` : "—"} />
            <Row k="EQUIPO" v={teamLabel} />
            <Row k="RANGO" v={rank.label} />
            <Row k="INGRESO" v={ingreso} />
          </div>

          <p className="label-mono normal-case tracking-normal text-[var(--color-text-dim)] text-[10.5px] mt-4 leading-relaxed">
            El rango se deriva de tus roles de Discord salvo que un admin haya fijado un override.
          </p>
        </div>

        {/* === Stats + editor === */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="panel-elevated panel-bracket p-4">
            <div className="label-mono-accent mb-3.5">// Estadísticas</div>
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-px"
              style={{
                background: "var(--color-border)",
                border: "1px solid var(--color-border)",
              }}
            >
              <Stat label="DESPLIEGUES" value={String(eventCount).padStart(2, "0")} />
              <Stat label="BOLETINES" value={String(bulletinCount).padStart(2, "0")} />
              <Stat label="EQUIPOS" value={String(mySlots.length).padStart(2, "0")} />
              <Stat label="ACCESO" value={`L${accessLevel}`} />
            </div>
          </div>

          <ProfileEditor
            initialNickname={user.nickname ?? ""}
            initialBio={user.bio ?? ""}
            initialAvatarUrl={user.avatarUrl}
          />
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="label-mono">{k}</div>
      <div
        className="mt-0.5 text-[12px] text-[var(--color-text)] truncate"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {v}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-panel)] p-3.5">
      <div className="label-mono">{label}</div>
      <div
        className="font-semibold text-[26px] mt-1 leading-none tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-accent)" }}
      >
        {value}
      </div>
    </div>
  );
}
