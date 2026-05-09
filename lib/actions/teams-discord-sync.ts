/**
 * Shared helpers for keeping Discord roles in lockstep with HUB team
 * memberships. Plain server module (no "use server" directive) so it
 * can be imported by multiple server-action files without becoming a
 * client-callable entry point itself.
 */

import { prisma } from "@/lib/db";
import {
  addRoleToMember,
  removeRoleFromMember,
  isGuildMember,
  DiscordBotError,
} from "@/lib/discord-bot";

/**
 * Add the team role + the team's category role to a Discord member.
 * Best-effort: returns a warning string when the user isn't in the
 * guild or Discord rejects the call.
 */
export async function syncMemberJoinedTeam(
  userId: string,
  teamId: string,
): Promise<string | null> {
  const [user, team] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, nickname: true, discordUsername: true },
    }),
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
    if (team.category?.discordRoleId)
      await addRoleToMember(user.discordId, team.category.discordRoleId, reason);
    return null;
  } catch (e) {
    return `Discord rechazó asignar roles a ${user.nickname ?? user.discordUsername ?? userId}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Remove the team role; if the user has no remaining team in the same
 * category, also strip the category role.
 */
export async function syncMemberLeftTeam(
  userId: string,
  teamId: string,
): Promise<string | null> {
  const [user, team] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, nickname: true, discordUsername: true },
    }),
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
        await removeRoleFromMember(user.discordId, team.category.discordRoleId, reason).catch(
          (e) => {
            if (e instanceof DiscordBotError && e.status === 404) return;
            throw e;
          },
        );
      }
    }
    return null;
  } catch (e) {
    return `Discord rechazó remover roles a ${user.nickname ?? user.discordUsername ?? userId}: ${e instanceof Error ? e.message : String(e)}`;
  }
}
