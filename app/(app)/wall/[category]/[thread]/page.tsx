import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { ThreadActions } from "./ThreadActions";
import { ReplyForm } from "./ReplyForm";
import { ReactionBar } from "@/components/ReactionBar";
import { PostCard } from "./PostCard";

export default async function ThreadPage({
  params,
}: { params: Promise<{ category: string; thread: string }> }) {
  const { category, thread: threadId } = await params;
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");

  const thread = await prisma.wallThread.findUnique({
    where: { id: threadId },
    include: {
      author: { select: { id: true, nickname: true, discordUsername: true } },
      category: true,
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, nickname: true, discordUsername: true } } },
      },
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  if (!thread || thread.category.slug !== category) notFound();

  // Group reactions: count + did *I* react?
  const grouped = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of thread.reactions) {
    const g = grouped.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    if (r.userId === user.id) g.mine = true;
    grouped.set(r.emoji, g);
  }
  const reactionGroups = Array.from(grouped.values());
  const canEditThread = thread.authorId === user.id || isAdmin;

  return (
    <>
      <PageHeader
        eyebrow={`// ${thread.category.name}${thread.pinned ? " · 📌 PINNED" : ""}`}
        title={thread.title}
        action={
          <ThreadActions
            threadId={thread.id}
            categorySlug={category}
            locked={!!thread.lockedByAdminId}
            pinned={thread.pinned}
            isAdmin={isAdmin}
            canEdit={canEditThread}
          />
        }
      />
      {thread.bannerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thread.bannerImageUrl} alt="" className="w-full max-h-[300px] object-cover border-b border-[var(--color-border)]" />
      )}
      <div className="p-8 space-y-4 max-w-4xl">
        <PostCard
          author={thread.author}
          createdAt={thread.createdAt}
          editedAt={thread.editedAt}
          body={thread.bodyJson}
        />

        <div className="px-1">
          <ReactionBar threadId={thread.id} categorySlug={category} initial={reactionGroups} />
        </div>

        {thread.replies.map((r) => (
          <PostCard
            key={r.id}
            author={r.author}
            createdAt={r.createdAt}
            editedAt={r.editedAt}
            body={r.bodyJson}
            reply={{ id: r.id, canEdit: r.authorId === user.id || isAdmin }}
          />
        ))}

        {thread.lockedByAdminId ? (
          <div className="panel p-5 text-center text-[var(--color-danger)] label-mono">
            Hilo bloqueado. Sin más respuestas.
          </div>
        ) : (
          <ReplyForm threadId={thread.id} />
        )}
      </div>
    </>
  );
}
