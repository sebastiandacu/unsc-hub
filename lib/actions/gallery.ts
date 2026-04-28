"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

const itemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().url(),
  mediaType: z.enum(["image", "video"]).default("image"),
});

export async function createGalleryItem(input: z.infer<typeof itemSchema>) {
  const admin = await requireAdmin();
  const data = itemSchema.parse(input);
  const item = await prisma.galleryItem.create({
    data: {
      title: data.title,
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl,
      mediaType: data.mediaType,
      uploadedById: admin.id,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "gallery.create", targetType: "GalleryItem", targetId: item.id },
  });
  revalidatePath("/gallery");
}

export async function updateGalleryItem(id: string, input: z.infer<typeof itemSchema>) {
  const admin = await requireAdmin();
  const data = itemSchema.parse(input);
  await prisma.galleryItem.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl,
      mediaType: data.mediaType,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "gallery.update", targetType: "GalleryItem", targetId: id },
  });
  revalidatePath("/gallery");
}

export async function deleteGalleryItem(id: string) {
  const admin = await requireAdmin();
  await prisma.galleryItem.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "gallery.delete", targetType: "GalleryItem", targetId: id },
  });
  revalidatePath("/gallery");
}
