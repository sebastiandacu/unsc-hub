"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import type { Permission } from "@prisma/client";

const PERMS: Permission[] = ["AUTHORIZED", "LICENSED", "CERTIFICATED", "ADMIN"];

async function audit(actorId: string, action: string, targetType: string, targetId: string, payload?: unknown) {
  await prisma.auditLog.create({
    data: { actorId, action, targetType, targetId, payloadJson: payload as object | undefined },
  });
}

export async function setPermission(userId: string, permission: Permission) {
  const admin = await requireAdmin();
  if (!PERMS.includes(permission)) throw new Error("Invalid permission");
  if (userId === admin.id && permission !== "ADMIN") throw new Error("Refusing to demote self");
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { permission: true } });
  if (!prev) throw new Error("User not found");
  if (prev.permission === permission) return; // no-op, don't pollute history
  await prisma.user.update({ where: { id: userId }, data: { permission } });
  await audit(admin.id, "user.setPermission", "User", userId, {
    from: prev.permission,
    to: permission,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/roster/${userId}`);
}

export async function toggleBan(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new Error("Refusing to ban self");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
  if (!target) throw new Error("User not found");
  await prisma.user.update({ where: { id: userId }, data: { banned: !target.banned } });
  await audit(admin.id, target.banned ? "user.unban" : "user.ban", "User", userId);
  revalidatePath("/admin/users");
}

export async function setNickname(userId: string, value: string | null) {
  const admin = await requireAdmin();
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > 60) throw new Error("Nickname máx 60 caracteres");
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
  if (!prev) throw new Error("User not found");
  if (prev.nickname === trimmed) return;
  await prisma.user.update({ where: { id: userId }, data: { nickname: trimmed } });
  await audit(admin.id, "user.setNickname", "User", userId, {
    from: prev.nickname,
    to: trimmed,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/roster/${userId}`);
  revalidatePath("/roster");
}

export async function setRankOverride(userId: string, value: string | null) {
  const admin = await requireAdmin();
  const trimmed = value?.trim() || null;
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { manualRankOverride: true } });
  if (!prev) throw new Error("User not found");
  if (prev.manualRankOverride === trimmed) return;
  await prisma.user.update({ where: { id: userId }, data: { manualRankOverride: trimmed } });
  await audit(admin.id, "user.setRankOverride", "User", userId, {
    from: prev.manualRankOverride,
    to: trimmed,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/roster/${userId}`);
}

const medalSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
});

export async function awardMedal(input: z.infer<typeof medalSchema>) {
  const admin = await requireAdmin();
  const data = medalSchema.parse(input);
  const medal = await prisma.medal.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      iconUrl: data.iconUrl || null,
      awardedById: admin.id,
    },
  });
  await audit(admin.id, "medal.award", "Medal", medal.id, { userId: data.userId, name: data.name });
  revalidatePath(`/roster/${data.userId}`);
  revalidatePath("/admin/users");
}

export async function revokeMedal(medalId: string) {
  const admin = await requireAdmin();
  const medal = await prisma.medal.delete({ where: { id: medalId } });
  await audit(admin.id, "medal.revoke", "Medal", medalId, { userId: medal.userId, name: medal.name });
  revalidatePath(`/roster/${medal.userId}`);
  revalidatePath("/admin/users");
}

const patchSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export async function awardPatch(input: z.infer<typeof patchSchema>) {
  const admin = await requireAdmin();
  const data = patchSchema.parse(input);
  const patch = await prisma.patch.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      awardedById: admin.id,
    },
  });
  await audit(admin.id, "patch.award", "Patch", patch.id, { userId: data.userId, name: data.name });
  revalidatePath(`/roster/${data.userId}`);
  revalidatePath("/admin/users");
}

export async function revokePatch(patchId: string) {
  const admin = await requireAdmin();
  const patch = await prisma.patch.delete({ where: { id: patchId } });
  await audit(admin.id, "patch.revoke", "Patch", patchId, { userId: patch.userId, name: patch.name });
  revalidatePath(`/roster/${patch.userId}`);
  revalidatePath("/admin/users");
}

// ─────────── Templates ───────────

const templateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export async function createMedalTemplate(input: z.infer<typeof templateSchema>) {
  const admin = await requireAdmin();
  const data = templateSchema.parse(input);
  const t = await prisma.medalTemplate.create({
    data: { name: data.name, description: data.description || null, iconUrl: data.imageUrl || null },
  });
  await audit(admin.id, "medalTemplate.create", "MedalTemplate", t.id, { name: t.name });
  revalidatePath("/admin/templates");
  revalidatePath("/admin/users");
}

export async function deleteMedalTemplate(templateId: string) {
  const admin = await requireAdmin();
  await prisma.medalTemplate.delete({ where: { id: templateId } });
  await audit(admin.id, "medalTemplate.delete", "MedalTemplate", templateId);
  revalidatePath("/admin/templates");
  revalidatePath("/admin/users");
}

export async function createPatchTemplate(input: z.infer<typeof templateSchema>) {
  const admin = await requireAdmin();
  const data = templateSchema.parse(input);
  const t = await prisma.patchTemplate.create({
    data: { name: data.name, description: data.description || null, imageUrl: data.imageUrl || null },
  });
  await audit(admin.id, "patchTemplate.create", "PatchTemplate", t.id, { name: t.name });
  revalidatePath("/admin/templates");
  revalidatePath("/admin/users");
}

export async function deletePatchTemplate(templateId: string) {
  const admin = await requireAdmin();
  await prisma.patchTemplate.delete({ where: { id: templateId } });
  await audit(admin.id, "patchTemplate.delete", "PatchTemplate", templateId);
  revalidatePath("/admin/templates");
  revalidatePath("/admin/users");
}

export async function awardMedalFromTemplate(userId: string, templateId: string) {
  const admin = await requireAdmin();
  const t = await prisma.medalTemplate.findUnique({ where: { id: templateId } });
  if (!t) throw new Error("Template not found");
  const medal = await prisma.medal.create({
    data: {
      userId,
      name: t.name,
      description: t.description,
      iconUrl: t.iconUrl,
      awardedById: admin.id,
    },
  });
  await audit(admin.id, "medal.awardTpl", "Medal", medal.id, { userId, templateId, name: t.name });
  revalidatePath(`/roster/${userId}`);
  revalidatePath("/admin/users");
}

export async function awardPatchFromTemplate(userId: string, templateId: string) {
  const admin = await requireAdmin();
  const t = await prisma.patchTemplate.findUnique({ where: { id: templateId } });
  if (!t) throw new Error("Template not found");
  const patch = await prisma.patch.create({
    data: {
      userId,
      name: t.name,
      description: t.description,
      imageUrl: t.imageUrl,
      awardedById: admin.id,
    },
  });
  await audit(admin.id, "patch.awardTpl", "Patch", patch.id, { userId, templateId, name: t.name });
  revalidatePath(`/roster/${userId}`);
  revalidatePath("/admin/users");
}
