"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  logoUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

function audit(actorId: string, action: string, targetId: string, payload?: object) {
  return prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType: "TeamCategory",
      targetId,
      payloadJson: payload as object | undefined,
    },
  });
}

function bust() {
  revalidatePath("/admin/teams");
  revalidatePath("/roster/teams");
}

export async function createTeamCategory(input: z.infer<typeof categorySchema>) {
  const admin = await requireAdmin();
  const data = categorySchema.parse(input);
  const cat = await prisma.teamCategory.create({
    data: {
      name: data.name,
      description: data.description?.trim() || null,
      color: data.color?.trim() || "#4dd0ff",
      logoUrl: data.logoUrl?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await audit(admin.id, "teamCategory.create", cat.id, { name: cat.name });
  bust();
  return cat.id;
}

export async function updateTeamCategory(id: string, input: z.infer<typeof categorySchema>) {
  const admin = await requireAdmin();
  const data = categorySchema.parse(input);
  await prisma.teamCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description?.trim() || null,
      color: data.color?.trim() || "#4dd0ff",
      logoUrl: data.logoUrl?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await audit(admin.id, "teamCategory.update", id);
  bust();
}

export async function deleteTeamCategory(id: string) {
  const admin = await requireAdmin();
  // Check whether any teams still belong to it.
  const orphans = await prisma.team.count({ where: { categoryId: id } });
  if (orphans > 0) {
    throw new Error(
      `No se puede borrar: ${orphans} ${orphans === 1 ? "equipo está" : "equipos están"} en esta categoría. Reasigná primero.`,
    );
  }
  await prisma.teamCategory.delete({ where: { id } });
  await audit(admin.id, "teamCategory.delete", id);
  bust();
}

export async function reorderTeamCategories(orderedIds: string[]) {
  const admin = await requireAdmin();
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.teamCategory.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  await audit(admin.id, "teamCategory.reorder", "bulk", { count: orderedIds.length });
  bust();
}
