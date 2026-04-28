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
        eyebrow="ARCHIVO VISUAL"
        title="Galería."
        description="Capturas de operaciones, after-action reports en imagen y archivo histórico."
        stamps={[
          { label: `▸ ${items.length} ${items.length === 1 ? "PIEZA" : "PIEZAS"}` },
        ]}
      />
      <div className="px-7 pb-7">
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
