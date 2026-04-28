import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { markRead } from "@/lib/actions/bulletin";
import { RichRenderer } from "@/components/editor/RichRenderer";
import { BulletinActions } from "./BulletinActions";
import { assertCanSeeBulletin } from "@/lib/visibility";

export default async function BulletinDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");
  const post = await prisma.bulletinPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, nickname: true, discordUsername: true } },
      reads: {
        include: { user: { select: { id: true, nickname: true, discordUsername: true } } },
        orderBy: { readAt: "asc" },
      },
      restrictedTeams: { select: { id: true, name: true } },
    },
  });
  if (!post) notFound();

  // Restricted-bulletin guard: bounce non-authorized users to the list.
  try {
    await assertCanSeeBulletin(id, user.id, isAdmin);
  } catch {
    redirect("/bulletin");
  }

  await markRead(id);

  const canManage = hasPermission(user, "LICENSED");
  const alreadyRead = post.reads.some((r) => r.user.id === user.id);

  return (
    <>
      <PageHeader
        eyebrow={`// Bulletin · ${post.author.nickname ?? post.author.discordUsername}`}
        title={post.title}
        action={canManage ? (
          <div className="flex gap-2">
            <Link href={`/bulletin/${post.id}/edit`} className="btn">Editar</Link>
            <BulletinActions postId={post.id} pinned={post.pinned} />
          </div>
        ) : undefined}
      />
      {post.bannerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.bannerImageUrl} alt="" className="w-full max-h-[360px] object-cover border-b border-[var(--color-border)]" />
      )}
      <div className="p-8 grid lg:grid-cols-[1fr_280px] gap-8">
        <article className="panel p-6">
          <div className="label-mono mb-4">{new Date(post.createdAt).toLocaleString()}</div>
          <RichRenderer doc={post.bodyJson} />
        </article>
        <aside className="panel p-5 h-fit">
          <h3 className="font-mono uppercase text-sm tracking-[0.16em]">Read Receipts</h3>
          <div className="label-mono mt-1 normal-case tracking-normal text-[10.5px] text-[var(--color-text-dim)]">
            {post.reads.length} {post.reads.length === 1 ? "lectura" : "lecturas"} · {alreadyRead ? "ya lo leíste" : "aún no lo has leído"}
          </div>
          {canManage && (
            <ul className="mt-4 space-y-1 max-h-[60vh] overflow-y-auto">
              {post.reads.map((r) => (
                <li key={r.user.id} className="flex items-center justify-between text-xs font-mono border-b border-[var(--color-border)] py-1">
                  <Link href={`/roster/${r.user.id}`} className="hover:text-[var(--color-accent)] truncate">
                    {r.user.nickname ?? r.user.discordUsername}
                  </Link>
                  <span className="text-[var(--color-muted)] shrink-0 ml-2">{new Date(r.readAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
