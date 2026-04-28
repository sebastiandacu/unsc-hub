import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { NewThreadDialog } from "./NewThreadDialog";

export default async function WallCategoryPage({
  params,
}: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  await requireUser();
  const cat = await prisma.wallCategory.findUnique({
    where: { slug: category },
    include: {
      threads: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          createdAt: true,
          headerImageUrl: true,
          lockedByAdminId: true,
          pinned: true,
          author: { select: { nickname: true, discordUsername: true } },
          _count: { select: { replies: true } },
        },
      },
    },
  });
  if (!cat) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`// Wall · ${cat.slug}`}
        title={cat.name}
        description={cat.description ?? undefined}
        action={<NewThreadDialog categorySlug={cat.slug} />}
      />
      <div className="p-8">
        {cat.threads.length === 0 ? (
          <div className="panel p-12 text-center text-[var(--color-muted)] font-mono">
            — Sin hilos. Empieza uno —
          </div>
        ) : (
          <ul className="space-y-2 reveal-stagger">
            {cat.threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/wall/${cat.slug}/${t.id}`}
                  className={`panel block hover:border-[var(--color-accent)] transition-colors flex items-center gap-4 overflow-hidden ${t.pinned ? "border-[var(--color-accent)]/60" : ""}`}
                >
                  {t.headerImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.headerImageUrl} alt="" className="w-24 h-16 object-cover border-r border-[var(--color-border)] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 px-5 py-4">
                    <div className="font-mono truncate flex items-center gap-2">
                      {t.pinned && <span className="label-mono text-[var(--color-accent)] shrink-0">📌 PIN</span>}
                      <span className="truncate">{t.title}</span>
                    </div>
                    <div className="label-mono mt-1">
                      {t.author.nickname ?? t.author.discordUsername} · {new Date(t.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="label-mono shrink-0 px-3">{t._count.replies} {t._count.replies === 1 ? "respuesta" : "respuestas"}</div>
                  {t.lockedByAdminId && <div className="label-mono text-[var(--color-danger)] pr-5">LOCKED</div>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
