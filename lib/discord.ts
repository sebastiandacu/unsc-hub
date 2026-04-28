/**
 * Discord REST helpers.
 *
 * - `fetchGuildMember` uses the bot token (server-side, cron + admin actions).
 * - `fetchOwnGuildMember` uses a user OAuth access token (login flow).
 *
 * Docs: https://discord.com/developers/docs/resources/guild#get-guild-member
 */
const API = "https://discord.com/api/v10";

export type DiscordMember = {
  user?: { id: string; username: string; global_name?: string; avatar?: string };
  nick?: string | null;
  roles: string[];
};

export async function fetchOwnGuildMember(
  accessToken: string,
  guildId: string,
): Promise<DiscordMember | null> {
  const res = await fetch(`${API}/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`discord ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchGuildMember(
  discordUserId: string,
  guildId = process.env.DISCORD_GUILD_ID!,
  botToken = process.env.DISCORD_BOT_TOKEN!,
): Promise<DiscordMember | null> {
  const res = await fetch(`${API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`discord ${res.status}: ${await res.text()}`);
  return res.json();
}

export function discordAvatarUrl(userId: string, hash?: string | null): string | null {
  if (!hash) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=256`;
}

export type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  hoist: boolean;
  managed: boolean;
};

export async function fetchGuildRoles(
  guildId = process.env.DISCORD_GUILD_ID!,
  botToken = process.env.DISCORD_BOT_TOKEN!,
): Promise<DiscordRole[]> {
  const res = await fetch(`${API}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`discord ${res.status}: ${await res.text()}`);
  const roles = (await res.json()) as DiscordRole[];
  return roles.sort((a, b) => b.position - a.position);
}
