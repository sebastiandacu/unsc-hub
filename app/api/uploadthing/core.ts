import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

const f = createUploadthing();

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new UploadThingError("Unauthorized");
  return session.user.id;
}

async function requireLicensed(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { permission: true } });
  if (!u || !hasPermission(u, "LICENSED")) throw new UploadThingError("Forbidden");
}

async function requireAdminUser(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { permission: true } });
  if (!u || u.permission !== "ADMIN") throw new UploadThingError("Forbidden");
}

export const ourFileRouter = {
  avatar: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => ({ userId: await requireSession() }))
    .onUploadComplete(async ({ metadata, file }) => {
      await prisma.user.update({ where: { id: metadata.userId }, data: { avatarUrl: file.ufsUrl } });
      return { url: file.ufsUrl };
    }),

  postImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const userId = await requireSession();
      await requireLicensed(userId);
      return { userId };
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  postBanner: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const userId = await requireSession();
      await requireLicensed(userId);
      return { userId };
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  threadImage: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => ({ userId: await requireSession() }))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  patchImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const userId = await requireSession();
      await requireAdminUser(userId);
      return { userId };
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  medalImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const userId = await requireSession();
      await requireAdminUser(userId);
      return { userId };
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  galleryImage: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const userId = await requireSession();
      await requireAdminUser(userId);
      return { userId };
    })
    .onUploadComplete(({ file }) => ({
      url: file.ufsUrl,
      mediaType: file.type?.startsWith("video/") ? "video" : "image",
    })),

  teamLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const userId = await requireSession();
      await requireAdminUser(userId);
      return { userId };
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
