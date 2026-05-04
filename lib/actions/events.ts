"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { notifyAllUsers } from "@/lib/notify";
import { absoluteUrl, postToDiscord } from "@/lib/discord-webhook";
import { postEventToDiscord, refreshEventDiscordMessage } from "@/lib/discord-event-message";
import type { RsvpStatus, EventOutcome } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docSchema: z.ZodType<any> = z.record(z.string(), z.any());

/**
 * Parse a datetime-local input ("YYYY-MM-DDTHH:MM") as Argentina time (UTC-3).
 * The HTML datetime-local input has no TZ info; Node's `new Date(s)` would
 * interpret it as the server's local TZ (UTC on Vercel), which silently
 * shifts everything 3 hours. We pin it to ART so the admin enters the time
 * they actually mean.
 */
function parseArgentinaInput(s: string): Date {
  // If the string already has an offset (Z, +/-HH:MM), trust it.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(`${s}:00-03:00`.replace(/(:\d{2}):\d{2}-/, "$1-")); // normalize seconds
}

/**
 * Build a localized Discord time string. Discord renders <t:UNIX:F> in each
 * viewer's own timezone, so a single message reads correctly for everyone.
 */
function discordTime(d: Date): string {
  const unix = Math.floor(d.getTime() / 1000);
  // Future events get a relative "in 3 days" tag, past events skip it —
  // a re-announce of an old event saying "a month ago" reads weird and
  // makes admins think the bot is broken.
  const isPast = d.getTime() < Date.now();
  return isPast ? `<t:${unix}:F>` : `<t:${unix}:F> · <t:${unix}:R>`;
}

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  briefingJson: docSchema,
  headerImageUrl: z.string().url().optional().nullable(),
  bannerImageUrl: z.string().url().optional().nullable(),
  slidesEmbedUrl: z.string().url().optional().nullable(),
  /// Visibility
  postToDiscord: z.boolean().optional(),
  pingEveryone: z.boolean().optional(),
  /// Empty = public (everyone). Non-empty = restricted to members of these teams.
  restrictedTeamIds: z.array(z.string()).optional(),
});

import { notifyMany } from "@/lib/notify";

/** Same restricted-fan-out logic as bulletins. */
async function notifyForEvent(
  restrictedTeamIds: string[],
  exceptUserId: string,
  payload: Parameters<typeof notifyMany>[1],
) {
  if (restrictedTeamIds.length === 0) {
    await notifyAllUsers(payload, exceptUserId);
    return;
  }
  const slots = await prisma.teamSlot.findMany({
    where: { teamId: { in: restrictedTeamIds }, holderId: { not: null } },
    select: { holderId: true },
  });
  const userIds = Array.from(
    new Set(slots.map((s) => s.holderId!).filter((id) => id !== exceptUserId)),
  );
  if (userIds.length === 0) return;
  await notifyMany(userIds, payload);
}

export async function createEvent(input: z.infer<typeof eventSchema>) {
  const admin = await requireAdmin();
  const data = eventSchema.parse(input);
  const postToDiscordFlag = data.postToDiscord ?? true;
  const pingEveryoneFlag = data.pingEveryone ?? true;
  const restrictedTeamIds = data.restrictedTeamIds ?? [];

  const event = await prisma.event.create({
    data: {
      title: data.title,
      startsAt: parseArgentinaInput(data.startsAt),
      endsAt: data.endsAt ? parseArgentinaInput(data.endsAt) : null,
      location: data.location?.trim() || null,
      briefingJson: data.briefingJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      slidesEmbedUrl: data.slidesEmbedUrl || null,
      createdById: admin.id,
      postToDiscord: postToDiscordFlag,
      pingEveryone: pingEveryoneFlag,
      restrictedTeams:
        restrictedTeamIds.length > 0
          ? { connect: restrictedTeamIds.map((id) => ({ id })) }
          : undefined,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "event.create",
      targetType: "Event",
      targetId: event.id,
      payloadJson: {
        postToDiscord: postToDiscordFlag,
        pingEveryone: pingEveryoneFlag,
        restrictedTeamCount: restrictedTeamIds.length,
      },
    },
  });

  const startDate = parseArgentinaInput(data.startsAt);
  const whenAR = startDate.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const eventPath = `/roster/schedule?event=${event.id}`;
  const restrictedSuffix = restrictedTeamIds.length > 0 ? " 🔒" : "";

  await Promise.allSettled([
    notifyForEvent(restrictedTeamIds, admin.id, {
      kind: "event.created",
      title: `📅 Nueva operación${restrictedSuffix}: ${data.title}`,
      body: `${whenAR} (ART)${data.location ? ` · ${data.location}` : ""}`,
      url: eventPath,
    }),
    // Bot-sent rich message with embed + RSVP buttons. Falls back to
    // the legacy webhook if the schedule channel isn't configured.
    postToDiscordFlag
      ? (process.env.DISCORD_SCHEDULE_CHANNEL_ID
          ? postEventToDiscord(event.id, {
              mentionEveryone: pingEveryoneFlag && restrictedTeamIds.length === 0,
            })
          : postToDiscord(
              {
                title: `📅 ${data.title}${restrictedSuffix}`,
                description: `Nueva operación programada.\n\n**[Ver briefing completo →](${absoluteUrl(eventPath)})**`,
                url: absoluteUrl(eventPath),
                fields: [
                  { name: "Cuándo (tu hora local)", value: discordTime(startDate), inline: false },
                  ...(data.location ? [{ name: "Dónde", value: data.location, inline: true }] : []),
                ],
                footer: "OPERATION · HUB",
              },
              {
                webhookUrl: process.env.DISCORD_SCHEDULE_WEBHOOK_URL,
                mentionEveryone: pingEveryoneFlag && restrictedTeamIds.length === 0,
              },
            ))
      : Promise.resolve(),
  ]);

  revalidatePath("/roster/schedule");
  revalidatePath("/admin/schedule");
}

export async function updateEvent(eventId: string, input: z.infer<typeof eventSchema>) {
  const admin = await requireAdmin();
  const data = eventSchema.parse(input);
  const restrictedTeamIds = data.restrictedTeamIds ?? [];
  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: data.title,
      startsAt: parseArgentinaInput(data.startsAt),
      endsAt: data.endsAt ? parseArgentinaInput(data.endsAt) : null,
      location: data.location?.trim() || null,
      briefingJson: data.briefingJson,
      headerImageUrl: data.headerImageUrl || null,
      bannerImageUrl: data.bannerImageUrl || null,
      slidesEmbedUrl: data.slidesEmbedUrl || null,
      postToDiscord: data.postToDiscord ?? true,
      pingEveryone: data.pingEveryone ?? true,
      restrictedTeams: { set: restrictedTeamIds.map((id) => ({ id })) },
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "event.update", targetType: "Event", targetId: eventId },
  });
  revalidatePath("/roster/schedule");
  revalidatePath("/admin/schedule");
}

export async function deleteEvent(eventId: string) {
  const admin = await requireAdmin();
  await prisma.event.delete({ where: { id: eventId } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "event.delete", targetType: "Event", targetId: eventId },
  });
  revalidatePath("/roster/schedule");
  revalidatePath("/admin/schedule");
}

const OUTCOMES: EventOutcome[] = ["PENDING", "SUCCESS", "PARTIAL", "FAILURE", "CANCELLED"];

const aarSchema = z.object({
  outcome: z.enum(["PENDING", "SUCCESS", "PARTIAL", "FAILURE", "CANCELLED"]),
  aarJson: docSchema.nullable(),
});

export async function setEventOutcome(eventId: string, input: z.infer<typeof aarSchema>) {
  const admin = await requireAdmin();
  const data = aarSchema.parse(input);
  if (!OUTCOMES.includes(data.outcome)) throw new Error("Invalid outcome");

  const prev = await prisma.event.findUnique({
    where: { id: eventId },
    select: { outcome: true, title: true, aarPostedAt: true },
  });
  if (!prev) throw new Error("Event not found");

  const hasAAR = !!data.aarJson;
  const wasNewlyPosted = hasAAR && !prev.aarPostedAt;

  await prisma.event.update({
    where: { id: eventId },
    data: {
      outcome: data.outcome,
      aarJson: data.aarJson ?? undefined,
      aarPostedAt: hasAAR ? (prev.aarPostedAt ?? new Date()) : prev.aarPostedAt,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "event.setOutcome",
      targetType: "Event",
      targetId: eventId,
      payloadJson: { from: prev.outcome, to: data.outcome, name: prev.title },
    },
  });

  // Notify everyone the first time an AAR drops.
  if (wasNewlyPosted) {
    await Promise.allSettled([
      notifyAllUsers(
        {
          kind: "event.aar",
          title: `📓 AAR publicado: ${prev.title}`,
          body: `Resultado: ${data.outcome}`,
          url: `/roster/schedule?event=${eventId}`,
        },
        admin.id,
      ),
      postToDiscord(
        {
          title: `📓 AAR · ${prev.title}`,
          description: `Resultado: **${data.outcome}**\n\n**[Leer AAR completo →](${absoluteUrl(`/roster/schedule?event=${eventId}`)})**`,
          url: absoluteUrl(`/roster/schedule?event=${eventId}`),
          footer: "AFTER-ACTION REPORT",
        },
        { webhookUrl: process.env.DISCORD_SCHEDULE_WEBHOOK_URL },
      ),
    ]);
  }

  // AAR drop / outcome change → repaint the Discord message so the
  // embed color + footer reflect the new outcome.
  await refreshEventDiscordMessage(eventId);

  revalidatePath("/roster/schedule");
  revalidatePath("/admin/schedule");
}

/**
 * Re-announce an existing event to the SCHEDULE channel + in-app notifications.
 * Useful for events created before the Discord webhook was configured.
 */
export async function announceEvent(eventId: string) {
  const admin = await requireAdmin();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, startsAt: true, location: true },
  });
  if (!event) throw new Error("Event not found");

  const whenAR = event.startsAt.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const eventPath = `/roster/schedule?event=${event.id}`;

  await Promise.allSettled([
    notifyAllUsers(
      {
        kind: "event.created",
        title: `📅 Operación: ${event.title}`,
        body: `${whenAR} (ART)${event.location ? ` · ${event.location}` : ""}`,
        url: eventPath,
      },
      admin.id,
    ),
    process.env.DISCORD_SCHEDULE_CHANNEL_ID
      ? postEventToDiscord(event.id, { mentionEveryone: true })
      : postToDiscord(
          {
            title: `📅 ${event.title}`,
            description: `Operación programada.\n\n**[Ver briefing completo →](${absoluteUrl(eventPath)})**`,
            url: absoluteUrl(eventPath),
            fields: [
              { name: "Cuándo (tu hora local)", value: discordTime(event.startsAt), inline: false },
              ...(event.location ? [{ name: "Dónde", value: event.location, inline: true }] : []),
            ],
            footer: "OPERATION · HUB",
          },
          {
            webhookUrl: process.env.DISCORD_SCHEDULE_WEBHOOK_URL,
            mentionEveryone: true,
          },
        ),
  ]);

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "event.announce", targetType: "Event", targetId: eventId },
  });
}

export async function setRsvp(eventId: string, status: RsvpStatus) {
  const user = await requireUser();
  await prisma.eventRSVP.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status },
    update: { status, setAt: new Date() },
  });
  // Push the new tally to Discord (best-effort).
  await refreshEventDiscordMessage(eventId);
  revalidatePath("/roster/schedule");
}

/**
 * Server-side equivalent of setRsvp called from the Discord interaction
 * handler — does the same DB upsert + Discord refresh, but takes a
 * userId directly instead of pulling from the session.
 */
export async function setRsvpFromDiscord(
  eventId: string,
  userId: string,
  status: RsvpStatus,
): Promise<void> {
  await prisma.eventRSVP.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, status },
    update: { status, setAt: new Date() },
  });
  await refreshEventDiscordMessage(eventId);
  revalidatePath("/roster/schedule");
}
