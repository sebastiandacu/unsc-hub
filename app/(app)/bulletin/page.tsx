import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";

export default async function BulletinPage() {
  const user = await requireUser();
  const canPost = hasPermission(user, "LICENSED");

  const posts = await prisma.bulletinPost.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      pinned: true,
      createdAt: true,
      headerImageUrl: true,
      author: { select: { nickname: true, discordUsername: true } },
      _count: { select: { reads: true } },
      reads: { where: { userId: user.id }, select: { readAt: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="// Internal Comms"
        title="Bulletin"
        description="Comunicados oficiales y órdenes. Los fijados aparecen primero."
        action={canPost ? <Link href="/bulletin/new" className="btn btn-primary">+ Nuevo bulletin</Link> : undefined}
      />
      <div className="p-8">
        {posts.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-muted)] font-mono">— Sin bulletins por ahora —</div>
        ) : (
          <ul className="space-y-3 reveal-stagger">
            {posts.map((p) => {
              const unread = p.reads.length === 0;
              return (
                <li key={p.id}>
                  <Link href={`/bulletin/${p.id}`} className="panel panel-bracket block hover:border-[var(--color-accent)] transition-colors overflow-hidden group">
                    {p.headerImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.headerImageUrl} alt="" className="w-full h-36 object-cover border-b border-[var(--color-border)] group-hover:scale-[1.02] transition-transform duration-500" />
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-3 flex-wrap">
                        {p.pinned && <span className="label-mono-accent flex items-center gap-1.5"><span className="size-1 bg-[var(--color-accent)]" />PINNED</span>}
                        {unread && <span className="label-mono text-[var(--color-danger)] flex items-center gap-1.5"><span className="size-1 bg-[var(--color-danger)] animate-pulse" />UNREAD</span>}
                        <span className="label-mono ml-auto">{new Date(p.createdAt).toLocaleString("es-ES")}</span>
                      </div>
                      <h2 className="display-md mt-3 group-hover:text-[var(--color-accent)] transition-colors" style={{ fontFamily: "var(--font-display)" }}>{p.title}</h2>
                      <div className="label-mono mt-3 flex items-center gap-2">
                        <span>{p.author.nickname ?? p.author.discordUsername}</span>
                        <span className="text-[var(--color-border-2)]">·</span>
                        <span>{p._count.reads} lectura{p._count.reads === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
