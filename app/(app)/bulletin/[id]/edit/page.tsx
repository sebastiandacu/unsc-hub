import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { BulletinComposer } from "../../BulletinComposer";

export default async function EditBulletinPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!hasPermission(user, "LICENSED")) redirect("/bulletin");
  const post = await prisma.bulletinPost.findUnique({ where: { id } });
  if (!post) notFound();
  return (
    <>
      <PageHeader eyebrow="// Editar Bulletin" title={post.title} />
      <div className="p-8 max-w-4xl">
        <BulletinComposer
          mode="edit"
          initial={{
            id: post.id,
            title: post.title,
            bodyJson: post.bodyJson as object,
            headerImageUrl: post.headerImageUrl,
            bannerImageUrl: post.bannerImageUrl,
            pinned: post.pinned,
          }}
        />
      </div>
    </>
  );
}
