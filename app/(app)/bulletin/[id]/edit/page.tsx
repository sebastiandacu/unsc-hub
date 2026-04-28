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
  const [post, teams] = await Promise.all([
    prisma.bulletinPost.findUnique({
      where: { id },
      include: { restrictedTeams: { select: { id: true } } },
    }),
    prisma.team.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        callsign: true,
        color: true,
        category: { select: { name: true } },
      },
    }),
  ]);
  if (!post) notFound();
  return (
    <>
      <PageHeader eyebrow="EDITAR BOLETÍN" title={post.title} />
      <div className="px-7 pb-7 max-w-4xl">
        <BulletinComposer
          mode="edit"
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            callsign: t.callsign,
            color: t.color,
            categoryName: t.category?.name ?? null,
          }))}
          initial={{
            id: post.id,
            title: post.title,
            bodyJson: post.bodyJson as object,
            headerImageUrl: post.headerImageUrl,
            bannerImageUrl: post.bannerImageUrl,
            pinned: post.pinned,
            postToDiscord: post.postToDiscord,
            pingEveryone: post.pingEveryone,
            restrictedTeamIds: post.restrictedTeams.map((t) => t.id),
          }}
        />
      </div>
    </>
  );
}
