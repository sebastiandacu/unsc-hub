import Link from "next/link";
import { redirect } from "next/navigation";
import { unit } from "@/config/unit";
import { signIn, auth } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // If already authenticated, skip the login page entirely — straight to /dashboard.
  // This kills the double-authorize bug (first callback lands here, bounces back).
  if (!error) {
    const session = await auth();
    if (session?.user?.id) redirect("/dashboard");
  }

  async function loginAction() {
    "use server";
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
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase">
                Terminal Seguro
              </div>
              <div className="label-mono text-[9px] mt-0.5 flex items-center gap-1.5">
                <span className="pulse-dot" />
                CHANNEL ENCRYPTED
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="label-mono">// Authentication</div>
          <h1
            className="display-md"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Acceder al Hub
          </h1>
        </div>

        <p className="mt-3 text-sm text-[var(--color-text-dim)] leading-relaxed">
          El acceso requiere el rol{" "}
          <span className="text-[var(--color-accent)] font-mono">Authorized</span>{" "}
          en el servidor de Discord de {unit.shortCode}.
        </p>

        {error === "AccessDenied" && (
          <div className="mt-6 border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3.5 text-xs font-mono text-[var(--color-danger)] flex items-start gap-2">
            <span>▲</span>
            <div>
              <div className="font-bold tracking-[0.2em] mb-1">ACCESS DENIED</div>
              <div className="text-[var(--color-danger)]/80 normal-case tracking-normal">
                Tu cuenta no está en el servidor o no tiene el rol requerido.
              </div>
            </div>
          </div>
        )}

        <form action={loginAction} className="mt-8 space-y-3">
          <button type="submit" className="btn btn-primary w-full justify-center py-3.5">
            Continuar con Discord
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[var(--color-border)] flex items-center justify-between text-[9.5px] font-mono uppercase tracking-[0.2em] text-[var(--color-muted)]">
          <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">
            ← Volver
          </Link>
          <span>v0.1.0 · SECURE BUILD</span>
        </div>
      </div>
    </main>
  );
}
