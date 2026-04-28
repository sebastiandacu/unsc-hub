import { requireUser, hasPermission } from "@/lib/auth/guards";
import { resolveRank } from "@/lib/rank";
import { prisma } from "@/lib/db";
import { Hero } from "@/components/unsc/Hero";
import { OperatorCard } from "@/components/unsc/OperatorCard";
import { OpsMap } from "@/components/unsc/OpsMap";
import { BulletinFeed } from "@/components/unsc/BulletinFeed";
import { ScheduleFeed } from "@/components/unsc/ScheduleFeed";
import { Directives } from "@/components/unsc/Directives";

const ONLINE_WINDOW_MIN = 15;

/**
 * Hash a string into a [0,100) bucket. Used to spread event pins around the
 * tactical map deterministically — same event = same spot, no shuffling.
 */
function hashBucket(s: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

function relativeUntil(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "EN VIVO";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const days = Math.floor(h / 24);
  return `${days}d ${h % 24}h`;
}

function relativeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "ahora";
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `hace ${Math.floor(sec / 86400)}d`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

const MONTHS_ES = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

const CATEGORY_ROTATION: Array<"red" | "amber" | "green" | "cyan"> = [
  "red", "amber", "green", "cyan",
];

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");
  const rank = await resolveRank(user.id);
  const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000);

  const [pinned, mySlots, upcoming, totalBulletins, unreadCount, rosterTotal, onlineNow] = await Promise.all([
    prisma.bulletinPost.findMany({
      where: { pinned: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        author: { select: { nickname: true, discordUsername: true } },
      },
    }),
    prisma.teamSlot.findMany({
      where: { holderId: user.id },
      include: { team: { select: { id: true, name: true, callsign: true, color: true } } },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 4,
      select: { id: true, title: true, startsAt: true, location: true },
    }),
    prisma.bulletinPost.count(),
    prisma.bulletinPost.count({
      where: { reads: { none: { userId: user.id } } },
    }),
    prisma.user.count({ where: { banned: false } }),
    prisma.user.count({
      where: {
        banned: false,
        lastSeenAt: { gte: since },
      },
    }),
  ]);

  const display = user.nickname || user.discordUsername || "Operativo";
  const rankShort = (rank.label || "OPERATIVO").split(" ").slice(0, 2).join(" ");

  // Build pins from upcoming events
  const pins = upcoming.slice(0, 5).map((e, i) => ({
    id: `OP-${e.title.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 14)}`,
    label: e.location ?? `Sector ${String.fromCharCode(65 + (i % 6))}${i + 1}`,
    x: 12 + hashBucket(e.id, 17) * 0.78,
    y: 14 + hashBucket(e.id, 31) * 0.6,
    color: i === 0 ? ("amber" as const) : i === 2 ? ("red" as const) : ("" as const),
  }));

  // Hero alerts
  const nextOp = upcoming[0];
  const alerts = [
    {
      label: `▸ INFORME ${new Date().toLocaleDateString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
      }).replace(/\//g, ".")}`,
    },
    upcoming.length > 0
      ? { label: `▸ ${upcoming.length} OP${upcoming.length > 1 ? "S" : ""} PROGRAMADAS`, tone: "amber" as const }
      : { label: "▸ SIN OPS PROGRAMADAS", tone: "muted" as const },
    { label: `▸ ROSTER ${onlineNow}/${rosterTotal}`, tone: "muted" as const },
  ];

  // Hero caret line
  const caretBits: string[] = [];
  if (mySlots.length > 0) caretBits.push(`Asignado a ${mySlots.length} ${mySlots.length === 1 ? "equipo" : "equipos"}.`);
  if (unreadCount > 0) caretBits.push(`${unreadCount} ${unreadCount === 1 ? "boletín" : "boletines"} sin leer.`);
  if (nextOp) {
    const rel = relativeUntil(nextOp.startsAt);
    caretBits.push(`Próximo despliegue en ${rel}.`);
  }
  caretBits.push("Toda actividad queda registrada.");
  const caretLine = caretBits.join(" ");

  // Operator card permissions
  const permStamps: { label: string; tone?: "default" | "amber" | "green" }[] = [];
  permStamps.push({ label: "▸ AUTORIZADO" });
  if (hasPermission(user, "LICENSED")) permStamps.push({ label: "▸ LICENCIA", tone: "green" });
  if (hasPermission(user, "CERTIFICATED")) permStamps.push({ label: "▸ CERTIFICADO", tone: "green" });
  if (isAdmin) permStamps.push({ label: "▸ ADMIN", tone: "amber" });

  // Bulletin items mapped
  const feedItems = pinned.map((b, i) => ({
    id: b.id,
    num: `B-${String(b.id.slice(-3)).toUpperCase()}`,
    category: i === 0 ? "ACTIONABLE" : i === 1 ? "IN-CHARACTER" : i === 2 ? "LORE" : "OFF-ROLE",
    categoryColor: CATEGORY_ROTATION[i % CATEGORY_ROTATION.length],
    title: b.title,
    ts: relativeAgo(b.createdAt),
    author: (b.author?.nickname ?? b.author?.discordUsername ?? "CMD").toUpperCase(),
  }));

  // Schedule items mapped
  const scheduleItems = upcoming.map((e) => {
    const d = new Date(e.startsAt);
    const time = d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
      hour12: false,
    });
    const detailParts = [`${time} ART`];
    if (e.location) detailParts.push(e.location);
    return {
      id: e.id,
      d: String(d.getDate()).padStart(2, "0"),
      m: MONTHS_ES[d.getMonth()],
      title: e.title,
      details: detailParts.join(" · "),
    };
  });

  // Directives — derived
  const directives: Array<{ code: string; title: string; urgency: "HOY" | "24H" | "48H" | "ESTE_MES"; href: string }> = [];
  let dirIdx = 1;
  if (nextOp) {
    const hoursAway = Math.max(0, (nextOp.startsAt.getTime() - Date.now()) / 3_600_000);
    const urgency: "HOY" | "24H" | "48H" | "ESTE_MES" =
      hoursAway < 24 ? "HOY" : hoursAway < 48 ? "24H" : hoursAway < 168 ? "48H" : "ESTE_MES";
    directives.push({
      code: `D-${String(dirIdx++).padStart(2, "0")}`,
      title: `Confirmar asistencia: ${nextOp.title}`,
      urgency,
      href: `/roster/schedule?event=${nextOp.id}`,
    });
  }
  if (unreadCount > 0) {
    directives.push({
      code: `D-${String(dirIdx++).padStart(2, "0")}`,
      title: `Revisar ${unreadCount} ${unreadCount === 1 ? "boletín" : "boletines"} sin leer`,
      urgency: unreadCount > 3 ? "HOY" : "24H",
      href: "/bulletin",
    });
  }
  if (!user.nickname) {
    directives.push({
      code: `D-${String(dirIdx++).padStart(2, "0")}`,
      title: "Asignar callsign / nickname en tu perfil",
      urgency: "ESTE_MES",
      href: "/profile",
    });
  }

  const idNumber = user.id.slice(-7).replace(/(.{2})(.+)/, "$1-$2").toUpperCase();
  const callsign = (user.nickname ?? user.discordUsername ?? "OPERATIVO").toUpperCase();
  const accessLevel = isAdmin ? 5 : hasPermission(user, "CERTIFICATED") ? 4 : hasPermission(user, "LICENSED") ? 3 : 2;

  return (
    <div className="p-7 space-y-5 reveal-stagger">
      {/* === Hero + Operator (top row) === */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-stretch">
        <Hero
          display={display}
          stats={{
            onlineNow,
            rosterTotal,
            activeOps: upcoming.length,
            nextOpRelative: nextOp ? relativeUntil(nextOp.startsAt) : "—",
            nextOpName: nextOp ? nextOp.title : null,
            bulletinUnread: unreadCount,
            bulletinTotal: totalBulletins,
          }}
          alerts={alerts}
          caretLine={caretLine}
        />
        <OperatorCard
          idNumber={idNumber}
          rankShort={rankShort.split(" ")[0] || "OP."}
          callsign={callsign}
          avatarUrl={user.avatarUrl}
          permissions={permStamps}
          accessLevel={accessLevel}
        />
      </div>

      {/* === Tactical map === */}
      <div>
        <div className="sect-h">
          <div className="sect-title">
            <span className="num">// 00</span>
            <h2>Mapa Táctico · Tiempo Real</h2>
            {upcoming.length > 0 && (
              <span className="stamp stamp-amber ml-1.5">
                {upcoming.length} {upcoming.length === 1 ? "OP ACTIVA" : "OPS ACTIVAS"}
              </span>
            )}
          </div>
        </div>
        <OpsMap pins={pins} />
      </div>

      {/* === Bulletin + Schedule === */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <BulletinFeed items={feedItems} unreadCount={unreadCount} />
        <ScheduleFeed items={scheduleItems} isAdmin={isAdmin} />
      </div>

      {/* === Directives === */}
      <Directives items={directives} />
    </div>
  );
}
