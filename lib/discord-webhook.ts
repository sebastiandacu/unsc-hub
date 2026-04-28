/**
 * Cross-post hub events to a Discord channel via webhook.
 * Configure DISCORD_BULLETIN_WEBHOOK_URL in env. Silently no-ops if absent.
 */

import { unit } from "@/config/unit";

type WebhookEmbed = {
  title: string;
  description?: string;
  url?: string;
  color?: number; // decimal RGB
  footer?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
};

const DEFAULT_COLOR = 0xc9a227; // unit gold

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "";

export function absoluteUrl(path: string): string {
  if (!SITE_URL) return path;
  return `${SITE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

type AllowedMentionParse = "roles" | "users" | "everyone";

export async function postToDiscord(
  embed: WebhookEmbed,
  opts?: {
    content?: string;
    webhookUrl?: string;
    mentionEveryone?: boolean;
    allowedMentions?: { parse?: AllowedMentionParse[]; roles?: string[]; users?: string[] };
  },
): Promise<void> {
  const url = opts?.webhookUrl || process.env.DISCORD_BULLETIN_WEBHOOK_URL;
  if (!url) return;

  const content = opts?.mentionEveryone
    ? `@everyone${opts.content ? `\n${opts.content}` : ""}`
    : opts?.content;

  const allowed_mentions =
    opts?.allowedMentions ??
    (opts?.mentionEveryone ? { parse: ["everyone" as const] } : undefined);

  const payload = {
    username: `${unit.shortCode} HUB`,
    avatar_url: SITE_URL ? absoluteUrl(unit.logo.seal) : undefined,
    content,
    allowed_mentions,
    embeds: [
      {
        title: embed.title.slice(0, 256),
        description: embed.description?.slice(0, 4000),
        url: embed.url,
        color: embed.color ?? DEFAULT_COLOR,
        footer: embed.footer ? { text: embed.footer } : undefined,
        fields: embed.fields?.slice(0, 25),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[discord-webhook] failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[discord-webhook] threw", e);
  }
}
