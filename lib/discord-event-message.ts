/**
 * Build, send, and edit the rich Discord message that announces a HUB event.
 * Lives separately from lib/actions/events.ts so the same builder can be
 * called from createEvent (initial post), setRsvp (re-render after a vote),
 * and setEventOutcome (re-render with AAR badge).
 */

import { prisma } from "@/lib/db";
import {
  sendChannelMessage,
  editChannelMessage,
  type DiscordMessagePayload,
  type DiscordEmbed,
  type DiscordEmbedField,
  type DiscordActionRow,
} from "@/lib/discord-bot";
import { absoluteUrl } from "@/lib/discord-webhook";
import type { Event, EventRSVP, EventOutcome } from "@prisma/client";

const COBALT = 0x4dd0ff;
const AMBER = 0xffb547;
const GREEN = 0x4ade80;
const RED = 0xff3b3b;
const GREY = 0x5b6b85;

function colorForOutcome(o: EventOutcome): number {
  switch (o) {
    case "SUCCESS":   return GREEN;
    case "PARTIAL":   return COBALT;
    case "FAILURE":   return RED;
    case "CANCELLED": return GREY;
    default:          return COBALT; // PENDING
  }
}

/** Recursively pull plain text out of a Tiptap doc. */
function extractText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof n.text === "string") out.push(n.text);
  if (n.type === "paragraph" || n.type === "heading") out.push("\n");
  if (n.type === "hardBreak") out.push("\n");
  if (Array.isArray(n.content)) for (const c of n.content) extractText(c, out);
}

function briefingPlainText(doc: unknown, max = 600): string {
  const buf: string[] = [];
  extractText(doc, buf);
  let txt = buf.join("").replace(/\n{3,}/g, "\n\n").trim();
  if (txt.length > max) txt = txt.slice(0, max - 1).trimEnd() + "…";
  return txt || "_(sin briefing)_";
}

/**
 * Render the time field. Discord renders <t:UNIX:F> in each viewer's
 * timezone, so a single message reads correctly for everyone.
 */
function discordTime(d: Date): string {
  const unix = Math.floor(d.getTime() / 1000);
  const isPast = d.getTime() < Date.now();
  return isPast ? `<t:${unix}:F>` : `<t:${unix}:F> · <t:${unix}:R>`;
}

type EventForMessage = Event & {
  rsvps: Array<
    Pick<EventRSVP, "status"> & {
      user: { nickname: string | null; discordUsername: string | null };
    }
  >;
  restrictedTeams?: { name: string }[];
};

/** Render a list of voter display names for one RSVP column. */
function renderVoterList(
  rsvps: EventForMessage["rsvps"],
  status: "GOING" | "MAYBE" | "DECLINED",
): string {
  const names = rsvps
    .filter((r) => r.status === status)
    .map((r) => r.user.nickname ?? r.user.discordUsername ?? "Operativo")
    .map((n) => `"${n}"`);
  if (names.length === 0) return "_—_";
  // Discord field value cap is 1024 chars — truncate gracefully.
  const MAX = 12;
  if (names.length <= MAX) return names.join("\n");
  const visible = names.slice(0, MAX).join("\n");
  return `${visible}\n_+${names.length - MAX} más_`;
}

/**
 * Build the full payload (embed + buttons + content) for an event.
 */
export function buildEventMessage(
  ev: EventForMessage,
  opts: { mentionEveryone?: boolean } = {},
): DiscordMessagePayload {
  const url = absoluteUrl(`/roster/schedule?event=${ev.id}`);
  const isPast = ev.startsAt.getTime() < Date.now();
  const restrictedNames = ev.restrictedTeams?.map((t) => t.name).join(", ") ?? "";
  const restrictedSuffix = restrictedNames ? " 🔒" : "";

  const going = ev.rsvps.filter((r) => r.status === "GOING").length;
  const maybe = ev.rsvps.filter((r) => r.status === "MAYBE").length;
  const declined = ev.rsvps.filter((r) => r.status === "DECLINED").length;

  const fields: DiscordEmbedField[] = [
    { name: "📅 Cuándo (tu hora local)", value: discordTime(ev.startsAt), inline: false },
    ...(ev.location ? [{ name: "📍 Dónde", value: ev.location, inline: false }] : []),
    // Three inline columns mirroring the Sesh-style attendance block:
    // names listed under each status with the count in the column header.
    {
      name: `✅ Voy (${going})`,
      value: renderVoterList(ev.rsvps, "GOING"),
      inline: true,
    },
    {
      name: `❌ No voy (${declined})`,
      value: renderVoterList(ev.rsvps, "DECLINED"),
      inline: true,
    },
    {
      name: `❓ Tal vez (${maybe})`,
      value: renderVoterList(ev.rsvps, "MAYBE"),
      inline: true,
    },
    ...(restrictedNames
      ? [{ name: "🔒 Restringida a", value: restrictedNames, inline: false }]
      : []),
  ];

  const desc = [
    briefingPlainText(ev.briefingJson, 600),
    "",
    `**[Ver briefing completo en el HUB →](${url})**`,
  ].join("\n");

  const embed: DiscordEmbed = {
    title: `${ev.title}${restrictedSuffix}`,
    description: desc,
    url,
    color: colorForOutcome(ev.outcome),
    fields,
    // Big header image only — no thumbnail in the corner. Prefer the
    // banner field (wider/hero ratio); fall back to the header image
    // if no banner was uploaded.
    image: ev.bannerImageUrl
      ? { url: ev.bannerImageUrl }
      : ev.headerImageUrl
        ? { url: ev.headerImageUrl }
        : undefined,
    footer: {
      text: ev.outcome !== "PENDING"
        ? `OPERATION · HUB · resultado: ${ev.outcome}`
        : "OPERATION · HUB",
    },
    timestamp: ev.createdAt.toISOString(),
  };

  // Buttons disabled once the event is past or marked complete.
  const buttonsDisabled = isPast || ev.outcome !== "PENDING";

  const components: DiscordActionRow[] = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3, // SUCCESS (green)
          label: "VOY",
          custom_id: `rsvp:${ev.id}:GOING`,
          emoji: { name: "✅" },
          disabled: buttonsDisabled,
        },
        {
          type: 2,
          style: 2, // SECONDARY (grey)
          label: "TAL VEZ",
          custom_id: `rsvp:${ev.id}:MAYBE`,
          emoji: { name: "❓" },
          disabled: buttonsDisabled,
        },
        {
          type: 2,
          style: 4, // DANGER (red)
          label: "NO VOY",
          custom_id: `rsvp:${ev.id}:DECLINED`,
          emoji: { name: "❌" },
          disabled: buttonsDisabled,
        },
        {
          type: 2,
          style: 5, // LINK
          label: "ABRIR EN HUB",
          url,
        },
      ],
    },
  ];

  // Content pings @everyone only when explicitly requested AND the event
  // isn't restricted to a subset of teams.
  const content =
    opts.mentionEveryone && (ev.restrictedTeams?.length ?? 0) === 0
      ? "@everyone"
      : undefined;

  return {
    content,
    embeds: [embed],
    components,
    allowed_mentions: opts.mentionEveryone ? { parse: ["everyone"] } : { parse: [] },
  };
}

/**
 * Persist event.discordChannelId + event.discordMessageId after first send.
 * Returns the message ID.
 */
export async function postEventToDiscord(
  eventId: string,
  opts: { mentionEveryone?: boolean } = {},
): Promise<string | null> {
  const channelId = process.env.DISCORD_SCHEDULE_CHANNEL_ID;
  if (!channelId) return null;

  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      rsvps: {
        select: {
          status: true,
          user: { select: { nickname: true, discordUsername: true } },
        },
      },
      restrictedTeams: { select: { name: true } },
    },
  });
  if (!ev) return null;

  const payload = buildEventMessage(ev, opts);
  const msg = await sendChannelMessage(channelId, payload);

  await prisma.event.update({
    where: { id: eventId },
    data: { discordChannelId: msg.channel_id, discordMessageId: msg.id },
  });
  return msg.id;
}

/**
 * Re-render the existing message in place (RSVP changes, AAR drops, etc.).
 * No-ops silently if we never posted (or if the bot can't reach the channel).
 */
export async function refreshEventDiscordMessage(eventId: string): Promise<void> {
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      rsvps: {
        select: {
          status: true,
          user: { select: { nickname: true, discordUsername: true } },
        },
      },
      restrictedTeams: { select: { name: true } },
    },
  });
  if (!ev || !ev.discordChannelId || !ev.discordMessageId) return;

  const payload = buildEventMessage(ev, { mentionEveryone: false });
  // Drop content/allowed_mentions on edits — Discord won't re-ping anyway,
  // and clearing content keeps the visible header clean.
  payload.content = "";
  payload.allowed_mentions = { parse: [] };

  try {
    await editChannelMessage(ev.discordChannelId, ev.discordMessageId, payload);
  } catch {
    // best-effort — don't block the action that triggered the refresh.
  }
}
