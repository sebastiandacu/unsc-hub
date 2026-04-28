"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { resolveRank } from "@/lib/rank";
import { notify, notifyAdmins } from "@/lib/notify";
import {
  createRole,
  editRole,
  deleteRole,
  addRoleToMember,
  removeRoleFromMember,
  isGuildMember,
  hexToColor,
  DiscordBotError,
} from "@/lib/discord-bot";

/**
 * Add the team role + the team's category role to a Discord member.
 * Best-effort: returns a warning string when the user isn't in the
 * guild or Discord rejects the call. Caller surfaces it.
 */
async function syncMemberJoinedTeam(userId: string, teamId: string): Promise<string | null> {
  const [user, team] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { discordId: true, nickname: true, discordUsername: true } }),
    prisma.team.findUnique({
      where: { id: teamId },
      include: { category: { select: { discordRoleId: true, name: true } } },
    }),
  ]);
  if (!user?.discordId || !team) return null;

  const reason = `HUB · ${user.nickname ?? user.discordUsername ?? userId} → ${team.name}`;
  try {
    const inGuild = await isGuildMember(user.discordId);
    if (!inGuild) {
      return `${user.nickname ?? user.discordUsername ?? "el usuario"} no está en el server de Discord. Cuando entre, los roles no se le van a aplicar automáticamente — lo tendrás que sincronizar a mano.`;
    }
    if (team.discordRoleId) await addRoleToMember(user.discordId, team.discordRoleId, reason);
    if (team.category?.discordRoleId) await addRoleToMember(user.discordId, team.category.discordRoleId, reason);
    return null;
  } catch (e) {
    return `Discord rechazó asignar roles a ${user.nickname ?? user.discordUsername ?? userId}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Remove the team role; if the user has no remaining team in the same
 * category, also strip the category role.
 */
async function syncMemberLeftTeam(userId: string, teamId: string): Promise<string | null> {
  const [user, team] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { discordId: true, nickname: true, discordUsername: true } }),
    prisma.team.findUnique({
      where: { id: teamId },
      include: { category: { select: { id: true, discordRoleId: true, name: true } } },
    }),
  ]);
  if (!user?.discordId || !team) return null;

  const reason = `HUB · ${user.nickname ?? user.discordUsername ?? userId} ← ${team.name}`;
  try {
    if (team.discordRoleId) {
      await removeRoleFromMember(user.discordId, team.discordRoleId, reason).catch((e) => {
        if (e instanceof DiscordBotError && e.status === 404) return;
        throw e;
      });
    }

    // Still in another team in the same category? Then keep the category role.
    if (team.category?.id && team.category.discordRoleId) {
      const stillIn = await prisma.teamSlot.count({
        where: {
          holderId: userId,
          team: { categoryId: team.category.id, id: { not: teamId } },
        },
      });
      if (stillIn === 0) {
        await removeRoleFromMember(user.discordId, team.category.discordRoleId, reason).catch((e) => {
          if (e instanceof DiscordBotError && e.status === 404) return;
          throw e;
        });
      }
    }
    return null;
  } catch (e) {
    return `Discord rechazó remover roles a ${user.nickname ?? user.discordUsername ?? userId}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const teamSchema = z.object({
  name: z.string().trim().min(1).max(80),
  callsign: z.string().trim().max(20).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  description: z.string().trim().max(500).optional().nullable(),
  allowsMultiMembership: z.boolean().optional(),
  minRankPriority: z.number().int().nullable().optional(),
  teamType: z.enum(["ORGANIZATIONAL", "OPERATIVE"]).optional(),
  /// Required at the application layer. Null in DB only for legacy teams
  /// that pre-date the categorization feature.
  categoryId: z.string().min(1, "Categoría obligatoria."),
});

export async function createTeam(input: z.infer<typeof teamSchema>) {
  const admin = await requireAdmin();
  const data = teamSchema.parse(input);
  const colorInt = hexToColor(data.color || "#c9a227");

  // Discord first (must-succeed). The team role is purely a distinction;
  // the category's role grants the actual channel access.
  let discordRoleId: string | null = null;
  try {
    const role = await createRole({
      name: data.name,
      color: colorInt,
      reason: `HUB · crear team ${data.name}`,
    });
    discordRoleId = role.id;
  } catch (e) {
    throw new Error(
      `Discord rechazó crear el rol del team: ${e instanceof Error ? e.message : String(e)}.`,
    );
  }

  let team;
  try {
    team = await prisma.team.create({
      data: {
        name: data.name,
        callsign: data.callsign?.trim() || null,
        color: data.color?.trim() || "#c9a227",
        logoUrl: data.logoUrl?.trim() || null,
        description: data.description?.trim() || null,
        allowsMultiMembership: !!data.allowsMultiMembership,
        minRankPriority: data.minRankPriority ?? null,
        teamType: data.teamType ?? "ORGANIZATIONAL",
        categoryId: data.categoryId,
        discordRoleId,
      },
    });
  } catch (e) {
    // DB failed after Discord succeeded — clean up the orphan role.
    if (discordRoleId) await deleteRole(discordRoleId).catch(() => {});
    throw e;
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "team.create",
      targetType: "Team",
      targetId: team.id,
      payloadJson: { discordRoleId },
    },
  });
  revalidatePath("/admin/teams");
  revalidatePath("/roster/teams");
  return team.id;
}

export async function updateTeam(id: string, input: z.infer<typeof teamSchema>) {
  const admin = await requireAdmin();
  const data = teamSchema.parse(input);
  const prev = await prisma.team.findUnique({ where: { id } });
  if (!prev) throw new Error("Team no encontrado");

  const renamed = data.name !== prev.name;
  const recolored = (data.color || "#c9a227") !== prev.color;
  const colorInt = hexToColor(data.color || "#c9a227");

  if (prev.discordRoleId && (renamed || recolored)) {
    try {
      await editRole(
        prev.discordRoleId,
        { name: data.name, color: colorInt },
        `HUB · editar team ${data.name}`,
      );
    } catch (e) {
      throw new Error(
        `Discord rechazó editar el rol del team: ${e instanceof Error ? e.message : String(e)}.`,
      );
    }
  }

  await prisma.team.update({
    where: { id },
    data: {
      name: data.name,
      callsign: data.callsign?.trim() || null,
      color: data.color?.trim() || "#c9a227",
      logoUrl: data.logoUrl?.trim() || null,
      description: data.description?.trim() || null,
      allowsMultiMembership: !!data.allowsMultiMembership,
      minRankPriority: data.minRankPriority ?? null,
      teamType: data.teamType ?? "ORGANIZATIONAL",
      categoryId: data.categoryId,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "team.update", targetType: "Team", targetId: id },
  });
  revalidatePath("/admin/teams");
  revalidatePath("/roster/teams");
  revalidatePath(`/roster/teams/${id}`);
}

export async function deleteTeam(id: string) {
  const admin = await requireAdmin();
  const prev = await prisma.team.findUnique({ where: { id } });
  if (!prev) return;

  if (prev.discordRoleId) {
    try {
      await deleteRole(prev.discordRoleId, `HUB · borrar team ${prev.name}`);
    } catch (e) {
      // 404 means it's already gone — ignore. Other errors block the delete
      // so the admin knows to clean up.
      if (!(e instanceof DiscordBotError && e.status === 404)) {
        throw new Error(
          `Discord rechazó borrar el rol del team: ${e instanceof Error ? e.message : String(e)}.`,
        );
      }
    }
  }

  await prisma.team.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "team.delete", targetType: "Team", targetId: id },
  });
  revalidatePath("/admin/teams");
  revalidatePath("/roster/teams");
}

const slotSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().trim().max(80).optional().nullable(),
  roleName: z.string().trim().max(80).optional().nullable(),
  joinMode: z.enum(["OPEN", "APPLY"]),
  minRankPriority: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
  autoName: z.boolean().optional(),
});

const slotUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  roleName: z.string().trim().max(80).nullable().optional(),
  joinMode: z.enum(["OPEN", "APPLY"]).optional(),
  minRankPriority: z.number().int().nullable().optional(),
});

/**
 * Auto-generate a slot title from the team's callsign + type.
 * ORGANIZATIONAL: first slot = "<Callsign> Actual", then "<Callsign>-1", "-2"...
 * OPERATIVE:      always "<Callsign>-1", "-2"...
 */
async function generateSlotTitle(teamId: string): Promise<string> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { callsign: true, name: true, teamType: true, slots: { select: { title: true } } },
  });
  if (!team) throw new Error("Team not found");
  const base = team.callsign?.trim() || team.name;
  const count = team.slots.length;
  if (team.teamType === "ORGANIZATIONAL") {
    if (count === 0) return `${base} Actual`;
    return `${base}-${count}`;
  }
  return `${base}-${count + 1}`;
}

export async function createSlot(input: z.infer<typeof slotSchema>) {
  const admin = await requireAdmin();
  const data = slotSchema.parse(input);
  const title = (data.autoName || !data.title?.trim())
    ? await generateSlotTitle(data.teamId)
    : data.title!.trim();
  const slot = await prisma.teamSlot.create({
    data: {
      teamId: data.teamId,
      title,
      roleName: data.roleName?.trim() || null,
      joinMode: data.joinMode,
      minRankPriority: data.minRankPriority ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "slot.create", targetType: "TeamSlot", targetId: slot.id, payloadJson: { teamId: data.teamId } },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${data.teamId}`);
}

export async function updateSlot(slotId: string, input: z.infer<typeof slotUpdateSchema>) {
  const admin = await requireAdmin();
  const data = slotUpdateSchema.parse(input);
  const slot = await prisma.teamSlot.findUnique({ where: { id: slotId }, select: { teamId: true } });
  if (!slot) throw new Error("Not found");
  await prisma.teamSlot.update({
    where: { id: slotId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.roleName !== undefined ? { roleName: data.roleName?.trim() || null } : {}),
      ...(data.joinMode !== undefined ? { joinMode: data.joinMode } : {}),
      ...(data.minRankPriority !== undefined ? { minRankPriority: data.minRankPriority } : {}),
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "slot.update", targetType: "TeamSlot", targetId: slotId },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${slot.teamId}`);
}

export async function deleteSlot(slotId: string) {
  const admin = await requireAdmin();
  const slot = await prisma.teamSlot.findUnique({ where: { id: slotId }, select: { teamId: true } });
  if (!slot) throw new Error("Not found");
  await prisma.teamSlot.delete({ where: { id: slotId } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "slot.delete", targetType: "TeamSlot", targetId: slotId },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${slot.teamId}`);
}

/**
 * Verify the user satisfies a slot's minimum rank gate.
 * Returns null if OK, or an error message string.
 */
async function checkRankGate(userId: string, teamMin: number | null, slotMin: number | null): Promise<string | null> {
  const min = slotMin ?? teamMin;
  if (min === null || min === undefined) return null;
  const rank = await resolveRank(userId);
  if (rank.priority === null) return "You don't have a Discord-derived rank required to take this slot.";
  if (rank.priority > min) return `This slot requires rank priority ≤ ${min}; you are ${rank.priority}.`;
  return null;
}

/**
 * Take an OPEN slot directly. If the team disallows multi-membership and the user
 * already holds another slot in that team, return a warning instead — the client
 * confirms then re-calls with `confirmRelease=true` to swap.
 */
export async function joinSlot(slotId: string, confirmRelease = false): Promise<{ ok: boolean; warn?: string; error?: string }> {
  const user = await requireUser();
  const slot = await prisma.teamSlot.findUnique({
    where: { id: slotId },
    include: { team: true },
  });
  if (!slot) return { ok: false, error: "Slot not found" };
  if (slot.joinMode !== "OPEN") return { ok: false, error: "This slot requires application" };
  if (slot.holderId) return { ok: false, error: "Slot already taken" };

  const banned = await prisma.teamBan.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: slot.teamId } },
  });
  if (banned) return { ok: false, error: "You are banned from this team." };

  const gate = await checkRankGate(user.id, slot.team.minRankPriority, slot.minRankPriority);
  if (gate) return { ok: false, error: gate };

  if (!slot.team.allowsMultiMembership) {
    const existing = await prisma.teamSlot.findFirst({
      where: { teamId: slot.teamId, holderId: user.id },
    });
    if (existing && !confirmRelease) {
      return { ok: false, warn: `You already hold "${existing.title}" on ${slot.team.name}. Joining "${slot.title}" releases the previous slot.` };
    }
    if (existing) {
      await prisma.teamSlot.update({ where: { id: existing.id }, data: { holderId: null } });
    }
  }

  await prisma.teamSlot.update({ where: { id: slotId }, data: { holderId: user.id } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "slot.join", targetType: "TeamSlot", targetId: slotId },
  });

  // Discord sync (best-effort: warning surfaces but doesn't roll back).
  const discordWarn = await syncMemberJoinedTeam(user.id, slot.teamId);

  revalidatePath(`/roster/teams/${slot.teamId}`);
  revalidatePath("/roster/teams");
  return { ok: true, warn: discordWarn ?? undefined };
}

export async function leaveSlot(slotId: string) {
  const user = await requireUser();
  const slot = await prisma.teamSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.holderId !== user.id) throw new Error("Not your slot");
  await prisma.teamSlot.update({ where: { id: slotId }, data: { holderId: null } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "slot.leave", targetType: "TeamSlot", targetId: slotId },
  });

  // Discord sync (best-effort).
  await syncMemberLeftTeam(user.id, slot.teamId);

  revalidatePath(`/roster/teams/${slot.teamId}`);
  revalidatePath("/roster/teams");
}

export async function applyToSlot(slotId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const slot = await prisma.teamSlot.findUnique({
    where: { id: slotId },
    include: { team: true },
  });
  if (!slot) return { ok: false, error: "Slot not found" };
  if (slot.joinMode !== "APPLY") return { ok: false, error: "Not an apply-mode slot" };
  if (slot.holderId) return { ok: false, error: "Slot already filled" };

  const banned = await prisma.teamBan.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: slot.teamId } },
  });
  if (banned) return { ok: false, error: "You are banned from this team." };

  const gate = await checkRankGate(user.id, slot.team.minRankPriority, slot.minRankPriority);
  if (gate) return { ok: false, error: gate };

  const existing = await prisma.teamApplication.findFirst({
    where: { slotId, applicantId: user.id, status: "PENDING" },
  });
  if (existing) return { ok: false, error: "You already have a pending application." };

  await prisma.teamApplication.create({
    data: { slotId, applicantId: user.id, message: message.trim() || null },
  });

  const who = user.nickname ?? user.discordUsername ?? "Operativo";
  await notifyAdmins(
    {
      kind: "application.created",
      title: `Nueva solicitud: ${who} → ${slot.team.name}`,
      body: slot.title,
      url: `/admin/teams`,
    },
    user.id,
  );

  revalidatePath(`/roster/teams/${slot.teamId}`);
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function reviewApplication(applicationId: string, approve: boolean, note?: string) {
  const admin = await requireAdmin();
  const app = await prisma.teamApplication.findUnique({
    where: { id: applicationId },
    include: { slot: { include: { team: true } } },
  });
  if (!app) throw new Error("Not found");
  if (app.status !== "PENDING") throw new Error("Already reviewed");

  const trimmedNote = note?.trim().slice(0, 500) || null;

  if (approve) {
    if (!app.slot.team.allowsMultiMembership) {
      // Find the previous slot they're being released from to sync Discord later.
      const previous = await prisma.teamSlot.findFirst({
        where: { teamId: app.slot.teamId, holderId: app.applicantId },
      });
      if (previous) {
        await prisma.teamSlot.updateMany({
          where: { teamId: app.slot.teamId, holderId: app.applicantId },
          data: { holderId: null },
        });
      }
    }
    await prisma.teamSlot.update({ where: { id: app.slotId }, data: { holderId: app.applicantId } });
    // Discord sync: add team + category roles.
    await syncMemberJoinedTeam(app.applicantId, app.slot.teamId);
  }

  await prisma.teamApplication.update({
    where: { id: applicationId },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewNote: trimmedNote,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: approve ? "application.approve" : "application.reject",
      targetType: "TeamApplication",
      targetId: applicationId,
      payloadJson: trimmedNote ? { note: trimmedNote } : undefined,
    },
  });

  await notify(app.applicantId, {
    kind: approve ? "application.approved" : "application.rejected",
    title: approve
      ? `✅ Solicitud aprobada: ${app.slot.team.name}`
      : `✗ Solicitud rechazada: ${app.slot.team.name}`,
    body: trimmedNote
      ? `${app.slot.title} — ${trimmedNote}`
      : app.slot.title,
    url: `/roster/teams/${app.slot.teamId}`,
  });

  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${app.slot.teamId}`);
}

export async function adminKickFromSlot(slotId: string) {
  const admin = await requireAdmin();
  const slot = await prisma.teamSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new Error("Slot not found");
  if (!slot.holderId) return;
  const previousHolder = slot.holderId;
  await prisma.teamSlot.update({ where: { id: slotId }, data: { holderId: null } });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "slot.kick",
      targetType: "TeamSlot",
      targetId: slotId,
      payloadJson: { kickedUserId: previousHolder, teamId: slot.teamId },
    },
  });
  await syncMemberLeftTeam(previousHolder, slot.teamId);
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${slot.teamId}`);
  revalidatePath("/roster/teams");
}

export async function adminAssignToSlot(slotId: string, userId: string) {
  const admin = await requireAdmin();
  const slot = await prisma.teamSlot.findUnique({
    where: { id: slotId },
    include: { team: true },
  });
  if (!slot) throw new Error("Slot not found");
  if (slot.holderId) throw new Error("Slot already filled — kick the current holder first.");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, banned: true } });
  if (!target) throw new Error("User not found");
  if (target.banned) throw new Error("User is banned site-wide.");

  const banned = await prisma.teamBan.findUnique({
    where: { userId_teamId: { userId, teamId: slot.teamId } },
  });
  if (banned) throw new Error("User is banned from this team.");

  if (!slot.team.allowsMultiMembership) {
    await prisma.teamSlot.updateMany({
      where: { teamId: slot.teamId, holderId: userId },
      data: { holderId: null },
    });
  }

  await prisma.teamSlot.update({ where: { id: slotId }, data: { holderId: userId } });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "slot.assign",
      targetType: "TeamSlot",
      targetId: slotId,
      payloadJson: { assignedUserId: userId, teamId: slot.teamId },
    },
  });
  await syncMemberJoinedTeam(userId, slot.teamId);
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${slot.teamId}`);
  revalidatePath("/roster/teams");
}

export async function adminBanFromTeam(teamId: string, userId: string, reason?: string) {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("Don't ban yourself.");
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found");

  // Snapshot whether they actually held a slot, so we know whether to sync.
  const wasMember = (await prisma.teamSlot.count({ where: { teamId, holderId: userId } })) > 0;
  await prisma.teamSlot.updateMany({
    where: { teamId, holderId: userId },
    data: { holderId: null },
  });
  if (wasMember) await syncMemberLeftTeam(userId, teamId);

  await prisma.teamBan.upsert({
    where: { userId_teamId: { userId, teamId } },
    create: { userId, teamId, bannedById: admin.id, reason: reason?.trim() || null },
    update: { bannedById: admin.id, reason: reason?.trim() || null },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "team.ban",
      targetType: "Team",
      targetId: teamId,
      payloadJson: { bannedUserId: userId, reason: reason ?? null },
    },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${teamId}`);
}

export async function adminUnbanFromTeam(teamId: string, userId: string) {
  const admin = await requireAdmin();
  await prisma.teamBan.delete({
    where: { userId_teamId: { userId, teamId } },
  }).catch(() => {});
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "team.unban",
      targetType: "Team",
      targetId: teamId,
      payloadJson: { unbannedUserId: userId },
    },
  });
  revalidatePath("/admin/teams");
  revalidatePath(`/roster/teams/${teamId}`);
}
