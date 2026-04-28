import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { ThreadEditor } from "./ThreadEditor";

export default async function EditThreadPage({
  params,
}: { params: Promise<{ category: string; thread: string }> }) {
  const { category, thread: threadId } = await params;
  const user = await requireUser();
  const thread = await prisma.wallThread.findUnique({
    where: { id: threadId },
    include: { category: true },
  });
  if (!thread || thread.category.slug !== category) notFound();

  const isAdmin = hasPermission(user, "ADMIN");
  if (thread.authorId !== user.id && !isAdmin) redirect(`/wall/${category}/${threadId}`);

  return (
    <>
      <PageHeader eyebrow={`// Editar hilo · ${thread.category.name}`} title={thread.title} />
      <div className="p-8 max-w-4xl">
        <ThreadEditor
          threadId={thread.id}
          categorySlug={category}
          initial={{
            title: thread.title,
            bodyJson: thread.bodyJson as object,
            headerImageUrl: thread.headerImageUrl,
            bannerImageUrl: thread.bannerImageUrl,
          }}
        />
      </div>
    </>
  );
}
