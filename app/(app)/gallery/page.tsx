import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth/guards";
import { GalleryClient } from "./GalleryClient";

export default async function GalleryPage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "ADMIN");

  const items = await prisma.galleryItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, nickname: true, discordUsername: true } },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="// Archive"
        title="Galería"
        description="Museo visual del unit. Operaciones, momentos, evidencia. Click en cualquier foto para verla en grande."
      />
      <div className="p-8">
        <GalleryClient
          isAdmin={isAdmin}
          items={items.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            imageUrl: i.imageUrl,
            mediaType: i.mediaType,
            createdAt: i.createdAt.toISOString(),
            uploadedByName: i.uploadedBy.nickname ?? i.uploadedBy.discordUsername ?? "—",
          }))}
        />
      </div>
    </>
  );
}
