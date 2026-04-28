/**
 * Discord REST helpers for the team↔role↔channel sync.
 *
 * Auth: uses DISCORD_BOT_TOKEN. The bot must:
 *   - have Manage Roles + Manage Channels in the guild
 *   - sit ABOVE in role hierarchy any role it creates/edits
 *
 * Failure model: every helper throws on non-2xx. Callers decide
 * whether to surface (must-succeed paths like CRUD) or swallow
 * (best-effort paths like slot membership).
 */

const API = "https://discord.com/api/v10";

/** Permission bit constants we use. Discord uses snowflake strings. */
export const PERM = {
  VIEW_CHANNEL:  1n << 10n,  // 1024
  SEND_MESSAGES: 1n << 11n,  // 2048
  CONNECT:       1n << 20n,  // 1048576 — VC connect
  SPEAK:         1n << 21n,  // 2097152
} as const;

/** Hex (`#4dd0ff` or `4dd0ff`) → Discord int color. */
export function hexToColor(hex: string): number {
  const clean = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0;
  return parseInt(clean, 16);
}

function token(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error("DISCORD_BOT_TOKEN not configured");
  return t;
}

function guildId(): string {
  const g = process.env.DISCORD_GUILD_ID;
  if (!g) throw new Error("DISCORD_GUILD_ID not configured");
  return g;
}

/**
 * Throw an Error tagged as `BotConfigError` when env is missing — lets
 * callers tell apart "Discord said no" from "we never tried".
 */
export class DiscordBotError extends Error {
  constructor(
    message: string,
    public status: number,
    public discordCode?: number,
    public path?: string,
  ) {
    super(message);
    this.name = "DiscordBotError";
  }
}

async function botFetch<T = unknown>(
  path: string,
  init: RequestInit & { auditLog?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bot ${token()}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (init.auditLog) headers.set("x-audit-log-reason", init.auditLog.slice(0, 512));

  const res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!res.ok) {
    let code: number | undefined;
    let msg = text;
    try {
      const j = JSON.parse(text);
      code = j.code;
      msg = j.message ?? text;
    } catch {
      /* leave raw */
    }
    throw new DiscordBotError(`Discord ${res.status}: ${msg}`, res.status, code, path);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ============================================================
// ROLES
// ============================================================

export type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

export async function listGuildRoles(): Promise<DiscordRole[]> {
  return botFetch<DiscordRole[]>(`/guilds/${guildId()}/roles`);
}

export async function createRole(opts: {
  name: string;
  color?: number;
  hoist?: boolean;
  reason?: string;
}): Promise<DiscordRole> {
  return botFetch<DiscordRole>(`/guilds/${guildId()}/roles`, {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      color: opts.color ?? 0,
      hoist: opts.hoist ?? false,
      mentionable: false,
    }),
    auditLog: opts.reason,
  });
}

export async function editRole(
  roleId: string,
  patch: { name?: string; color?: number; hoist?: boolean },
  reason?: string,
): Promise<DiscordRole> {
  return botFetch<DiscordRole>(`/guilds/${guildId()}/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    auditLog: reason,
  });
}

export async function deleteRole(roleId: string, reason?: string): Promise<void> {
  await botFetch(`/guilds/${guildId()}/roles/${roleId}`, {
    method: "DELETE",
    auditLog: reason,
  });
}

// ============================================================
// CHANNELS
// ============================================================

const CHANNEL_TYPE = {
  GUILD_TEXT:     0,
  GUILD_VOICE:    2,
  GUILD_CATEGORY: 4,
} as const;

export type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

type PermissionOverwrite = {
  id: string;
  type: 0 | 1; // 0=role, 1=member
  allow: string;
  deny: string;
};

/**
 * Create a channel category that's hidden from @everyone but visible
 * to the team-category role.
 */
export async function createCategoryChannel(opts: {
  name: string;
  categoryRoleId: string;
  reason?: string;
}): Promise<DiscordChannel> {
  const overwrites: PermissionOverwrite[] = [
    {
      id: guildId(), // @everyone has the same id as the guild
      type: 0,
      allow: "0",
      deny: PERM.VIEW_CHANNEL.toString(),
    },
    {
      id: opts.categoryRoleId,
      type: 0,
      allow: PERM.VIEW_CHANNEL.toString(),
      deny: "0",
    },
  ];
  return botFetch<DiscordChannel>(`/guilds/${guildId()}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      type: CHANNEL_TYPE.GUILD_CATEGORY,
      permission_overwrites: overwrites,
    }),
    auditLog: opts.reason,
  });
}

export async function createTextChannel(opts: {
  name: string;
  parentId: string;
  /** If set, only these role IDs can SEND_MESSAGES; everyone else read-only. */
  shoutAuthorizedRoleIds?: string[];
  /** Role that grants visibility (the category role). */
  visibilityRoleId: string;
  reason?: string;
}): Promise<DiscordChannel> {
  const overwrites: PermissionOverwrite[] = [
    {
      id: guildId(),
      type: 0,
      allow: "0",
      deny: PERM.VIEW_CHANNEL.toString(),
    },
    // Category role: read-only by default; if no shoutAuthorized list, also write.
    {
      id: opts.visibilityRoleId,
      type: 0,
      allow: opts.shoutAuthorizedRoleIds?.length
        ? PERM.VIEW_CHANNEL.toString()
        : (PERM.VIEW_CHANNEL | PERM.SEND_MESSAGES).toString(),
      deny: opts.shoutAuthorizedRoleIds?.length ? PERM.SEND_MESSAGES.toString() : "0",
    },
    // Shout-authorized roles: read + write override.
    ...(opts.shoutAuthorizedRoleIds ?? []).map<PermissionOverwrite>((rid) => ({
      id: rid,
      type: 0,
      allow: (PERM.VIEW_CHANNEL | PERM.SEND_MESSAGES).toString(),
      deny: "0",
    })),
  ];
  return botFetch<DiscordChannel>(`/guilds/${guildId()}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      type: CHANNEL_TYPE.GUILD_TEXT,
      parent_id: opts.parentId,
      permission_overwrites: overwrites,
    }),
    auditLog: opts.reason,
  });
}

export async function createVoiceChannel(opts: {
  name: string;
  parentId: string;
  visibilityRoleId: string;
  reason?: string;
}): Promise<DiscordChannel> {
  const overwrites: PermissionOverwrite[] = [
    { id: guildId(), type: 0, allow: "0", deny: PERM.VIEW_CHANNEL.toString() },
    {
      id: opts.visibilityRoleId,
      type: 0,
      allow: (PERM.VIEW_CHANNEL | PERM.CONNECT | PERM.SPEAK).toString(),
      deny: "0",
    },
  ];
  return botFetch<DiscordChannel>(`/guilds/${guildId()}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      type: CHANNEL_TYPE.GUILD_VOICE,
      parent_id: opts.parentId,
      permission_overwrites: overwrites,
    }),
    auditLog: opts.reason,
  });
}

export async function editChannel(
  channelId: string,
  patch: Record<string, unknown>,
  reason?: string,
): Promise<void> {
  await botFetch(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    auditLog: reason,
  });
}

export async function deleteChannel(channelId: string, reason?: string): Promise<void> {
  await botFetch(`/channels/${channelId}`, {
    method: "DELETE",
    auditLog: reason,
  });
}

/**
 * Replace a channel's permission_overwrites entirely. Use to reapply
 * shout-authorized lists when an admin edits the category.
 */
export async function setShoutChannelPermissions(
  channelId: string,
  visibilityRoleId: string,
  shoutAuthorizedRoleIds: string[],
  reason?: string,
): Promise<void> {
  const overwrites: PermissionOverwrite[] = [
    { id: guildId(), type: 0, allow: "0", deny: PERM.VIEW_CHANNEL.toString() },
    {
      id: visibilityRoleId,
      type: 0,
      allow: shoutAuthorizedRoleIds.length
        ? PERM.VIEW_CHANNEL.toString()
        : (PERM.VIEW_CHANNEL | PERM.SEND_MESSAGES).toString(),
      deny: shoutAuthorizedRoleIds.length ? PERM.SEND_MESSAGES.toString() : "0",
    },
    ...shoutAuthorizedRoleIds.map<PermissionOverwrite>((rid) => ({
      id: rid,
      type: 0,
      allow: (PERM.VIEW_CHANNEL | PERM.SEND_MESSAGES).toString(),
      deny: "0",
    })),
  ];
  await editChannel(channelId, { permission_overwrites: overwrites }, reason);
}

// ============================================================
// MEMBERSHIP
// ============================================================

/**
 * Returns true when the role was added (or was already there). Throws
 * DiscordBotError on failure; callers in best-effort paths should
 * catch and surface a warning to the admin.
 */
export async function addRoleToMember(
  userDiscordId: string,
  roleId: string,
  reason?: string,
): Promise<void> {
  await botFetch(
    `/guilds/${guildId()}/members/${userDiscordId}/roles/${roleId}`,
    { method: "PUT", auditLog: reason },
  );
}

export async function removeRoleFromMember(
  userDiscordId: string,
  roleId: string,
  reason?: string,
): Promise<void> {
  await botFetch(
    `/guilds/${guildId()}/members/${userDiscordId}/roles/${roleId}`,
    { method: "DELETE", auditLog: reason },
  );
}

/** True when the user is a member of the guild; false on 404. */
export async function isGuildMember(userDiscordId: string): Promise<boolean> {
  try {
    await botFetch(`/guilds/${guildId()}/members/${userDiscordId}`);
    return true;
  } catch (e) {
    if (e instanceof DiscordBotError && e.status === 404) return false;
    throw e;
  }
}
