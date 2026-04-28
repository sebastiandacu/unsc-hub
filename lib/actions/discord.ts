"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { fetchGuildMember, fetchGuildRoles } from "@/lib/discord";

async function audit(actorId: string, action: string, payload?: unknown) {
  await prisma.auditLog.create({
    data: { actorId, action, payloadJson: payload as object | undefined },
  });
}

export async function listGuildRoles() {
  await requireAdmin();
  return fetchGuildRoles();
}

const prioritySchema = z.object({
  roleId: z.string().min(1),
  displayLabel: z.string().min(1).max(80),
  priorityOrder: z.number().int(),
});

export async function addPriority(input: z.infer<typeof prioritySchema>) {
  const admin = await requireAdmin();
  const data = prioritySchema.parse(input);
  await prisma.discordRolePriority.upsert({
    where: { roleId: data.roleId },
    create: data,
    update: { displayLabel: data.displayLabel, priorityOrder: data.priorityOrder },
  });
  await audit(admin.id, "discord.addPriority", data);
  revalidatePath("/admin/discord");
}

export async function removePriority(roleId: string) {
  const admin = await requireAdmin();
  await prisma.discordRolePriority.delete({ where: { roleId } });
  await audit(admin.id, "discord.removePriority", { roleId });
  revalidatePath("/admin/discord");
}

export async function resyncUser(userId: string) {
  const admin = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!target?.discordId) throw new Error("User has no linked Discord ID");
  const member = await fetchGuildMember(target.discordId);
  if (!member) {
    await prisma.discordRoleSnapshot.upsert({
      where: { userId },
      create: { userId, roleIds: [], inGuild: false },
      update: { roleIds: [], inGuild: false, rolesFetchedAt: new Date() },
    });
  } else {
    await prisma.discordRoleSnapshot.upsert({
      where: { userId },
      create: { userId, roleIds: member.roles, inGuild: true },
      update: { roleIds: member.roles, inGuild: true, rolesFetchedAt: new Date() },
    });
  }
  await audit(admin.id, "discord.resyncUser", { userId });
  revalidatePath("/admin/users");
  revalidatePath(`/roster/${userId}`);
}

export async function resyncAllUsers() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    where: { banned: false, discordId: { not: null } },
    select: { id: true, discordId: true },
  });
  let ok = 0;
  let missing = 0;
  for (const u of users) {
    if (!u.discordId) continue;
    try {
      const member = await fetchGuildMember(u.discordId);
      await prisma.discordRoleSnapshot.upsert({
        where: { userId: u.id },
        create: { userId: u.id, roleIds: member?.roles ?? [], inGuild: !!member },
        update: { roleIds: member?.roles ?? [], inGuild: !!member, rolesFetchedAt: new Date() },
      });
      if (member) ok++; else missing++;
    } catch {
      missing++;
    }
  }
  await audit(admin.id, "discord.resyncAll", { ok, missing, total: users.length });
  revalidatePath("/admin/users");
  revalidatePath("/admin/discord");
  return { ok, missing, total: users.length };
}
