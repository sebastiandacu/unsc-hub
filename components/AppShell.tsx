"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { unit } from "@/config/unit";
import { NotificationBell } from "./NotificationBell";
import { SearchCommand } from "./SearchCommand";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const NAV: { href: string; label: string; code: string }[] = [
  { href: "/dashboard",       label: "Dashboard",  code: "00" },
  { href: "/bulletin",        label: "Bulletin",   code: "01" },
  { href: "/wall",            label: "Wall",       code: "02" },
  { href: "/roster",          label: "Roster",     code: "03" },
  { href: "/roster/teams",    label: "Teams",      code: "04" },
  { href: "/roster/schedule", label: "Schedule",   code: "05" },
  { href: "/gallery",         label: "Galería",    code: "06" },
  { href: "/profile",         label: "Mi Perfil",  code: "07" },
];

const ADMIN_NAV: { href: string; label: string; code: string }[] = [
  { href: "/admin/users",     label: "Users",      code: "A0" },
  { href: "/admin/teams",     label: "Teams",      code: "A1" },
  { href: "/admin/schedule",  label: "Schedule",   code: "A2" },
  { href: "/admin/templates", label: "Templates",  code: "A3" },
  { href: "/admin/discord",   label: "Discord",    code: "A4" },
  { href: "/admin/audit",     label: "Audit Log",  code: "A5" },
];

const TICKER_TOKENS = [
  "TOP SECRET",
  "UNSC EYES ONLY",
  "ACCESO AUTORIZADO",
  "NO DISTRIBUIR",
  "CANAL CIFRADO",
  "DIRECTIVA 7-G",
  "REGISTRO ACTIVO",
  "PROTOCOLO COBALT",
];

export function AppShell({
  user,
  isAdmin,
  notifications,
  children,
}: {
  user: { nickname: string | null; discordUsername: string | null; avatarUrl: string | null };
  isAdmin: boolean;
  notifications: { items: NotificationItem[]; unreadCount: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const display = user.nickname || user.discordUsername || "Operative";
  const [time, setTime] = useState<string>("");
  const [navOpen, setNavOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " ZULU"
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* === Classification ticker === */}
      <div className="classification-bar">
        <div className="ticker-track">
          {[...TICKER_TOKENS, ...TICKER_TOKENS, ...TICKER_TOKENS].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-3">
              <span>▰▰</span>
              <span>{t}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 md:grid md:grid-cols-[260px_1fr] min-h-0 relative">
        {/* === Mobile backdrop === */}
        {navOpen && (
          <div
            onClick={() => setNavOpen(false)}
            className="md:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-sm"
          />
        )}
        {/* === Sidebar === */}
        <aside
          className={cn(
            "border-r border-[var(--color-border)] bg-[var(--color-panel)]/95 md:bg-[var(--color-panel)]/70 backdrop-blur-sm flex flex-col",
            "fixed md:static inset-y-0 left-0 z-40 w-[260px] transition-transform duration-300",
            navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          {/* Header */}
          <div className="px-5 py-5 border-b border-[var(--color-border)] relative overflow-hidden">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <BrandMark />
              <div className="min-w-0">
                <div className="text-base tracking-tight uppercase leading-none font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {unit.shortCode}<span className="text-[var(--color-accent)]">/</span>HUB
                </div>
                <div className="label-mono mt-1 text-[8.5px]">Terminal Táctico · v0.1</div>
              </div>
            </Link>
            <div className="mt-3 flex justify-between text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--color-muted)]">
              <span>NODO 7-G</span>
              <span className="text-[var(--color-success)]">● ENLACE</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 overflow-y-auto">
            <div className="label-mono px-3 mb-2 text-[9px]">// Operaciones</div>
            <div className="space-y-0.5">
              {NAV.map((item) => (
                <NavItem key={item.href} item={item} pathname={pathname} accent="accent" />
              ))}
            </div>

            {isAdmin && (
              <>
                <div className="label-mono mt-6 mb-2 px-3 text-[9px] flex items-center gap-2">
                  <span className="size-1 bg-[var(--color-danger)]" />
                  // Admin
                </div>
                <div className="space-y-0.5">
                  {ADMIN_NAV.map((item) => (
                    <NavItem key={item.href} item={item} pathname={pathname} accent="danger" />
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t border-[var(--color-border)]">
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-panel-2)] transition-colors group"
            >
              <div className="size-9 border border-[var(--color-border-2)] overflow-hidden grid place-items-center text-[10px] font-mono bg-[var(--color-base)] group-hover:border-[var(--color-accent)] transition-colors">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  display.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate font-medium">{display}</div>
                <div className="label-mono truncate text-[9px]">{user.discordUsername ?? ""}</div>
              </div>
              <span className="text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">›</span>
            </Link>

            <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="pulse-dot" />
                <span className="label-mono text-[9px]">{time}</span>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button className="label-mono hover:text-[var(--color-danger)] transition-colors text-[9px]">
                  Cerrar sesión →
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* === Main === */}
        <main className="min-w-0 flex flex-col">
          <Topbar
            onMenu={() => setNavOpen(true)}
            search={<SearchCommand />}
            notifications={
              <NotificationBell
                initialItems={notifications.items}
                initialUnread={notifications.unreadCount}
              />
            }
          />
          {children}
        </main>
      </div>
    </div>
  );
}

function Topbar({
  onMenu,
  search,
  notifications,
}: {
  onMenu: () => void;
  search: React.ReactNode;
  notifications: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sector, setSector] = useState("G7-04A");
  const [ping, setPing] = useState(14);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setSector(`G${7 + (d.getSeconds() % 4)}-${String(4 + (d.getMinutes() % 20)).padStart(2, "0")}A`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPing(10 + Math.floor(Math.random() * 12)), 1400);
    return () => clearInterval(id);
  }, []);

  // Crumb segments derived from URL.
  const segs = pathname.split("/").filter(Boolean);
  const top = segs[0] === "admin" ? "ADMIN" : "HUB";
  const last = (segs.length > 1 ? segs[segs.length - 1] : segs[0] ?? "DASHBOARD")
    .replace(/-/g, " ")
    .toUpperCase();

  return (
    <div className="topbar flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 border-b border-[var(--color-border)] bg-[rgba(8,13,24,0.7)] backdrop-blur-sm sticky top-0 z-[4]">
      <button
        onClick={onMenu}
        className="md:hidden size-9 grid place-items-center border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
        aria-label="Abrir menú"
      >
        <span className="flex flex-col gap-1">
          <span className="block w-4 h-0.5 bg-current" />
          <span className="block w-4 h-0.5 bg-current" />
          <span className="block w-4 h-0.5 bg-current" />
        </span>
      </button>

      {/* Crumb */}
      <div className="hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)]">
        <span className="size-1.5 bg-[var(--color-accent)]" />
        <span>UNSC</span>
        <span className="text-[var(--color-border-2)]">/</span>
        <span>{top}</span>
        {top === "ADMIN" && segs.length > 1 && (
          <>
            <span className="text-[var(--color-border-2)]">/</span>
            <span style={{ color: "var(--color-accent)" }}>{last}</span>
          </>
        )}
        {top !== "ADMIN" && (
          <>
            <span className="text-[var(--color-border-2)]">/</span>
            <span style={{ color: "var(--color-accent)" }}>{last}</span>
          </>
        )}
      </div>

      <Link
        href="/dashboard"
        className="md:hidden uppercase tracking-tight text-sm font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        UNSC<span className="text-[var(--color-accent)]">/</span>HUB
      </Link>

      <div className="flex-1" />

      {/* Telemetry */}
      <div className="hidden xl:flex items-center gap-4 font-mono text-[10px] tracking-[0.14em] text-[var(--color-text-dim)]">
        <Tele label="SECTOR">{sector}</Tele>
        <Tele label="UPLINK">
          <FFT />
        </Tele>
        <Tele label="PING">{ping}ms</Tele>
        <Tele label="CIFRADO">
          <span style={{ color: "var(--color-success)" }}>AES-256</span>
        </Tele>
      </div>

      {search}
      {notifications}
    </div>
  );
}

function Tele({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span>{children}</span>
    </span>
  );
}

function FFT() {
  return (
    <span className="inline-flex items-end gap-[2px] h-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="w-[2px] bg-[var(--color-accent)]"
          style={{
            animation: `fft-bar 1.2s ease-in-out ${(i % 6) * 0.1}s infinite`,
            height: "30%",
          }}
        />
      ))}
      <style>{`
        @keyframes fft-bar {
          0%, 100% { height: 25%; }
          50% { height: 100%; }
        }
      `}</style>
    </span>
  );
}

function BrandMark() {
  return (
    <div className="size-11 relative grid place-items-center shrink-0 transition-transform group-hover:rotate-6 group-hover:scale-105 duration-300">
      <svg
        viewBox="0 0 44 44"
        width="44"
        height="44"
        style={{ filter: "drop-shadow(0 0 6px rgba(77, 208, 255, 0.35))" }}
      >
        <defs>
          <linearGradient id="bm-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" />
            <stop offset="1" stopColor="var(--color-accent-dim)" />
          </linearGradient>
        </defs>
        <polygon
          points="22,3 39,12 39,32 22,41 5,32 5,12"
          fill="none"
          stroke="url(#bm-grad)"
          strokeWidth="1.4"
        />
        <polygon
          points="22,9 34,15 34,29 22,35 10,29 10,15"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <path
          d="M14 26 L22 14 L30 26 L26 26 L22 20 L18 26 Z"
          fill="var(--color-accent)"
        />
        <line x1="22" y1="3" x2="22" y2="9" stroke="var(--color-accent)" strokeWidth="0.5" />
        <line x1="22" y1="35" x2="22" y2="41" stroke="var(--color-accent)" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function NavItem({
  item,
  pathname,
  accent,
}: {
  item: { href: string; label: string; code: string };
  pathname: string;
  accent: "accent" | "danger";
}) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
    (item.href !== "/dashboard" && pathname === item.href);
  const accentColor = accent === "danger" ? "var(--color-danger)" : "var(--color-accent)";

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 text-sm font-mono uppercase tracking-[0.14em] border-l-2 transition-all duration-200",
        active
          ? "text-[var(--text-active)] bg-[var(--bg-active)]"
          : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]/50"
      )}
      style={
        active
          ? ({
              borderColor: accentColor,
              ["--text-active" as string]: accentColor,
              ["--bg-active" as string]:
                accent === "danger" ? "rgba(220,38,38,0.08)" : "var(--color-accent-soft)",
            } as React.CSSProperties)
          : undefined
      }
    >
      <span className="text-[9px] opacity-50 group-hover:opacity-100 transition-opacity">
        {item.code}
      </span>
      <span className="text-[12px] flex-1">{item.label}</span>
      {active && (
        <span
          className="text-[10px]"
          style={{ color: accentColor }}
        >
          ●
        </span>
      )}
    </Link>
  );
}
