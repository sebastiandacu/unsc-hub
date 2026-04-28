"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createRole,
  editRole,
  deleteRole,
  createCategoryChannel,
  createTextChannel,
  createVoiceChannel,
  setShoutChannelPermissions,
  editChannel,
  deleteChannel,
  hexToColor,
  listGuildRoles,
  type DiscordRole,
} from "@/lib/discord-bot";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  logoUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  /// Discord role IDs allowed to write in #shout. Empty = the category role itself.
  shoutAuthorizedRoleIds: z.array(z.string()).optional(),
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

/** Channel-name-safe slug — lowercase, hyphens, ASCII. */
function channelSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90) || "categoria";
}

/**
 * Create a category in DB and atomically provision Discord:
 *   1. role
 *   2. channel category (locked to role)
 *   3. #<slug>-shout (read-only by default)
 *   4. #<slug>-chat
 *   5. 🔊 <slug>-voz
 * If any Discord call fails, we roll back what we created and throw.
 */
export async function createTeamCategory(input: z.infer<typeof categorySchema>) {
  const admin = await requireAdmin();
  const data = categorySchema.parse(input);
  const colorInt = hexToColor(data.color || "#4dd0ff");
  const slug = channelSlug(data.name);

  // ---- Discord provisioning (must succeed) ---------------------
  let roleId: string | null = null;
  let categoryChannelId: string | null = null;
  let shoutChannelId: string | null = null;
  let chatChannelId: string | null = null;
  let voiceChannelId: string | null = null;

  try {
    const role = await createRole({
      name: data.name,
      color: colorInt,
      hoist: true,
      reason: `HUB · crear categoría ${data.name} (admin ${admin.id})`,
    });
    roleId = role.id;

    const cat = await createCategoryChannel({
      name: data.name,
      categoryRoleId: role.id,
      reason: `HUB · canal-categoría para ${data.name}`,
    });
    categoryChannelId = cat.id;

    const shout = await createTextChannel({
      name: `${slug}-shout`,
      parentId: cat.id,
      visibilityRoleId: role.id,
      shoutAuthorizedRoleIds: data.shoutAuthorizedRoleIds ?? [],
      reason: `HUB · canal #${slug}-shout`,
    });
    shoutChannelId = shout.id;

    const chat = await createTextChannel({
      name: `${slug}-chat`,
      parentId: cat.id,
      visibilityRoleId: role.id,
      reason: `HUB · canal #${slug}-chat`,
    });
    chatChannelId = chat.id;

    const voice = await createVoiceChannel({
      name: `${slug}-voz`,
      parentId: cat.id,
      visibilityRoleId: role.id,
      reason: `HUB · canal de voz ${slug}`,
    });
    voiceChannelId = voice.id;
  } catch (e) {
    // Rollback what we managed to create so we don't leak Discord garbage.
    if (voiceChannelId) await deleteChannel(voiceChannelId).catch(() => {});
    if (chatChannelId) await deleteChannel(chatChannelId).catch(() => {});
    if (shoutChannelId) await deleteChannel(shoutChannelId).catch(() => {});
    if (categoryChannelId) await deleteChannel(categoryChannelId).catch(() => {});
    if (roleId) await deleteRole(roleId).catch(() => {});
    throw new Error(
      `Discord rechazó la creación: ${e instanceof Error ? e.message : String(e)}. Verificá que el bot tenga permisos Manage Roles + Manage Channels y que su rol esté arriba en la jerarquía.`,
    );
  }

  // ---- DB row -------------------------------------------------
  const cat = await prisma.teamCategory.create({
    data: {
      name: data.name,
      description: data.description?.trim() || null,
      color: data.color?.trim() || "#4dd0ff",
      logoUrl: data.logoUrl?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
      shoutAuthorizedRoleIds: data.shoutAuthorizedRoleIds ?? [],
      discordRoleId: roleId,
      discordChannelCategoryId: categoryChannelId,
      discordShoutChannelId: shoutChannelId,
      discordChatChannelId: chatChannelId,
      discordVoiceChannelId: voiceChannelId,
    },
  });
  await audit(admin.id, "teamCategory.create", cat.id, {
    name: cat.name,
    discordRoleId: roleId,
  });
  bust();
  return cat.id;
}

export async function updateTeamCategory(id: string, input: z.infer<typeof categorySchema>) {
  const admin = await requireAdmin();
  const data = categorySchema.parse(input);
  const prev = await prisma.teamCategory.findUnique({ where: { id } });
  if (!prev) throw new Error("Categoría no encontrada");

  // Sync Discord first (must-succeed) ---------------------------
  const colorInt = hexToColor(data.color || "#4dd0ff");
  const renamed = data.name !== prev.name;
  const recolored = (data.color || "#4dd0ff") !== prev.color;
  const shoutListChanged = !sameStringArrays(
    data.shoutAuthorizedRoleIds ?? [],
    prev.shoutAuthorizedRoleIds,
  );

  try {
    if (prev.discordRoleId && (renamed || recolored)) {
      await editRole(
        prev.discordRoleId,
        { name: data.name, color: colorInt },
        `HUB · editar categoría ${data.name}`,
      );
    }
    if (prev.discordChannelCategoryId && renamed) {
      await editChannel(
        prev.discordChannelCategoryId,
        { name: data.name },
        `HUB · renombrar categoría ${data.name}`,
      );
    }
    if (prev.discordShoutChannelId && prev.discordRoleId && shoutListChanged) {
      await setShoutChannelPermissions(
        prev.discordShoutChannelId,
        prev.discordRoleId,
        data.shoutAuthorizedRoleIds ?? [],
        `HUB · actualizar lista shout-authorized`,
      );
    }
  } catch (e) {
    throw new Error(
      `Discord rechazó la edición: ${e instanceof Error ? e.message : String(e)}.`,
    );
  }

  await prisma.teamCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description?.trim() || null,
      color: data.color?.trim() || "#4dd0ff",
      logoUrl: data.logoUrl?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
      shoutAuthorizedRoleIds: data.shoutAuthorizedRoleIds ?? [],
    },
  });
  await audit(admin.id, "teamCategory.update", id);
  bust();
}

export async function deleteTeamCategory(id: string) {
  const admin = await requireAdmin();
  const orphans = await prisma.team.count({ where: { categoryId: id } });
  if (orphans > 0) {
    throw new Error(
      `No se puede borrar: ${orphans} ${orphans === 1 ? "equipo está" : "equipos están"} en esta categoría. Reasigná primero.`,
    );
  }
  const cat = await prisma.teamCategory.findUnique({ where: { id } });
  if (!cat) return;

  // Try to clean up Discord. Best-effort here; we don't want a stale
  // Discord role to block deleting a HUB row that was already orphaned.
  // But we DO want to surface the error so the admin can clean up by hand.
  const failures: string[] = [];
  for (const [label, channelId] of [
    ["voice", cat.discordVoiceChannelId],
    ["chat", cat.discordChatChannelId],
    ["shout", cat.discordShoutChannelId],
    ["category", cat.discordChannelCategoryId],
  ] as const) {
    if (!channelId) continue;
    try {
      await deleteChannel(channelId, `HUB · borrar categoría ${cat.name}`);
    } catch (e) {
      failures.push(`canal ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (cat.discordRoleId) {
    try {
      await deleteRole(cat.discordRoleId, `HUB · borrar categoría ${cat.name}`);
    } catch (e) {
      failures.push(`rol: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await prisma.teamCategory.delete({ where: { id } });
  await audit(admin.id, "teamCategory.delete", id, { failures });
  bust();

  if (failures.length > 0) {
    throw new Error(
      `Categoría borrada del HUB pero hubo errores en Discord (limpiá a mano):\n• ${failures.join("\n• ")}`,
    );
  }
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

// ============================================================
// Helper for the admin shout-authorized role picker
// ============================================================

/**
 * Server action: list all roles in the guild (excluding @everyone and
 * managed/integration roles). The admin picks from these to grant
 * shout-write permission per category.
 */
export async function fetchGuildRoles(): Promise<
  Array<{ id: string; name: string; color: number; position: number }>
> {
  await requireAdmin();
  const roles: DiscordRole[] = await listGuildRoles();
  return roles
    .filter((r) => !r.managed && r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position }));
}

function sameStringArrays(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
