import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { unit } from "@/config/unit";
import { signIn, auth } from "@/lib/auth";
import { validateInvite } from "@/lib/actions/invites";

const INVITE_COOKIE = "unsc_invite";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;

  // If already authenticated, skip the login page entirely — straight to /dashboard.
  // This kills the double-authorize bug (first callback lands here, bounces back).
  if (!error) {
    const session = await auth();
    if (session?.user?.id) redirect("/dashboard");
  }

  // If an invite code is in the URL, pre-validate it server-side so we
  // can render the partner banner. Real consumption happens after the
  // OAuth round-trip in events.signIn.
  const invitePreview = invite ? await validateInvite(invite) : null;
  const inviteValid = invitePreview?.ok === true;

  async function loginAction() {
    "use server";
    if (invite && inviteValid) {
      // Persist the invite across the OAuth redirect so the auth.ts
      // callbacks can read it. httpOnly + 10-min ttl is plenty for a
      // single OAuth round-trip.
      const jar = await cookies();
      jar.set(INVITE_COOKIE, invite.trim().toUpperCase(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 600,
        path: "/",
      });
    }
    await signIn("discord", { redirectTo: "/dashboard" });
  }

  return (
    <main className="relative z-10 min-h-screen grid place-items-center px-6 scan-sweep">
      <div className="w-full max-w-md panel panel-bracket p-8 reveal">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="size-12 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={unit.logo.seal} alt={unit.shortCode} className="size-full object-contain drop-shadow-[0_0_10px_rgba(212,167,44,0.35)]" />
            </div>
            <div>
              <div className="font-mono text-sm tracking-[0.18em] uppercase">TERMINAL SEGURO</div>
              <div className="label-mono">CHANNEL ENCRYPTED</div>
            </div>
          </div>
        </div>

        <div>
          <div className="label-mono-accent mb-1.5">// AUTHENTICATION</div>
          <h1
            className="display-md"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Acceder al Hub
          </h1>
        </div>

        {invite && invitePreview?.ok && (
          <div className="mt-5 border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 p-3.5 text-xs font-mono flex items-start gap-2">
            <span>🎟️</span>
            <div>
              <div className="font-bold tracking-[0.2em] mb-1 text-[var(--color-accent)]">
                INVITACIÓN VÁLIDA
              </div>
              <div className="text-[var(--color-text-dim)] normal-case tracking-normal">
                Estás entrando vía <span className="text-[var(--color-accent)] font-bold">{invitePreview.label}</span>.
                Continúa con Discord para activar tu acceso.
                {invitePreview.remaining !== null && (
                  <div className="mt-1 text-[10px] opacity-80">
                    Quedan {invitePreview.remaining} usos disponibles.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {invite && invitePreview && !invitePreview.ok && (
          <div className="mt-5 border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3.5 text-xs font-mono flex items-start gap-2 text-[var(--color-danger)]">
            <span>▲</span>
            <div>
              <div className="font-bold tracking-[0.2em] mb-1">INVITACIÓN INVÁLIDA</div>
              <div className="text-[var(--color-danger)]/80 normal-case tracking-normal">
                {invitePreview.reason} Si tenías un código alternativo, intentá con ese, o pedile al admin uno nuevo.
              </div>
            </div>
          </div>
        )}

        {!invite && (
          <p className="mt-3 text-sm text-[var(--color-text-dim)] leading-relaxed">
            El acceso requiere el rol{" "}
            <span className="text-[var(--color-accent)] font-mono">
              {process.env.NEXT_PUBLIC_AUTHORIZED_ROLE_NAME ?? "Authorized"}
            </span>{" "}
            en el servidor de Discord de {unit.shortCode}.
          </p>
        )}

        {error === "AccessDenied" && (
          <div className="mt-6 border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3.5 text-xs font-mono text-[var(--color-danger)] flex items-start gap-2">
            <span>▲</span>
            <div>
              <div className="font-bold tracking-[0.2em] mb-1">ACCESS DENIED</div>
              <div className="text-[var(--color-danger)]/80 normal-case tracking-normal space-y-2">
                <div>
                  Tu cuenta no está en el servidor o no tiene el rol{" "}
                  <span className="font-bold">
                    {process.env.NEXT_PUBLIC_AUTHORIZED_ROLE_NAME ?? "Authorized"}
                  </span>{" "}
                  asignado.
                </div>
                <div className="text-[10.5px] opacity-80">
                  Pediles a un admin que te asigne ese rol específicamente
                  (no otro con nombre parecido). Después esperá ~30 segundos
                  y reintentá — Discord cachea la membresía. Si sos de una
                  comunidad amiga, pedí un código de invitación.
                </div>
              </div>
            </div>
          </div>
        )}

        <form action={loginAction} className="mt-8 space-y-3">
          <button type="submit" className="btn btn-primary w-full justify-center py-3.5">
            {invite && invitePreview?.ok ? "Activar invitación con Discord" : "Continuar con Discord"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[var(--color-border)] flex justify-between items-center text-[var(--color-muted)]">
          <Link href="/" className="label-mono hover:text-[var(--color-accent)]">
            ← Volver
          </Link>
          <span className="label-mono">v0.1.0 · SECURE BUILD</span>
        </div>
      </div>
    </main>
  );
}
