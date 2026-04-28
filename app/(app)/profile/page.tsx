import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth/guards";
import { resolveRank } from "@/lib/rank";
import { ProfileEditor } from "./ProfileEditor";

export default async function MyProfilePage() {
  const user = await requireUser();
  const rank = await resolveRank(user.id);

  return (
    <>
      <PageHeader
        eyebrow="// Personnel File"
        title="Mi Perfil"
        description="Configura el nombre y la biografía que otros operativos ven en el roster."
      />
      <div className="p-8 grid lg:grid-cols-[260px_1fr] gap-8">
        <div className="panel p-4">
          <div className="aspect-square bg-[var(--color-base)] border border-[var(--color-border)] grid place-items-center overflow-hidden">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-mono text-3xl text-[var(--color-muted)]">
                {(user.nickname ?? user.discordUsername ?? "??").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2 text-xs font-mono">
            <Row k="Discord"    v={user.discordUsername ?? "—"} />
            <Row k="Rango"      v={rank.label} />
            <Row k="Permiso"    v={user.permission} />
          </div>
          <p className="label-mono mt-4 normal-case tracking-normal text-[var(--color-text-dim)] text-[10.5px]">
            El rango se deriva de tus roles de Discord salvo que un admin haya fijado un override.
          </p>
        </div>

        <ProfileEditor
          initialNickname={user.nickname ?? ""}
          initialBio={user.bio ?? ""}
          initialAvatarUrl={user.avatarUrl}
        />
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-[var(--color-border)] pb-1">
      <span className="text-[var(--color-muted)]">{k}</span>
      <span>{v}</span>
    </div>
  );
}
