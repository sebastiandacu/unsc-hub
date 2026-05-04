/**
 * Discord interactions endpoint.
 *
 * Discord POSTs here every time someone clicks a button on a bot-sent
 * message. We must:
 *   1. Verify the Ed25519 signature on the raw body. Discord rejects
 *      our app from production until this works.
 *   2. Respond to PING (type 1) with PONG (type 1) — Discord pings
 *      this endpoint at config-save time to confirm we own it.
 *   3. Handle MESSAGE_COMPONENT (type 3) for button clicks. Our buttons
 *      use custom_id format `rsvp:<eventId>:<status>`.
 *
 * Response timing matters: Discord requires a reply within 3 seconds.
 * RSVP processing is one upsert + one message edit, so it should fit;
 * if it ever balloons we should switch to DEFERRED_UPDATE_MESSAGE (6)
 * + a follow-up.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyInteractionSignature } from "@/lib/discord-bot";
import { setRsvpFromDiscord } from "@/lib/actions/events";
import type { RsvpStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;

// Response types
const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DEFERRED_UPDATE_MESSAGE = 6;

// Message flags
const EPHEMERAL = 1 << 6; // 64

const RSVP_LABEL: Record<RsvpStatus, string> = {
  GOING:    "✅ marcado como **VOY**",
  MAYBE:    "❓ marcado como **TAL VEZ**",
  DECLINED: "❌ marcado como **NO VOY**",
};

function ephemeral(content: string) {
  return NextResponse.json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  });
}

export async function POST(req: Request) {
  // Read raw body BEFORE parsing — signature is over the literal bytes.
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return new NextResponse("missing signature", { status: 401 });
  }

  if (!verifyInteractionSignature(signature, timestamp, rawBody)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let body: {
    type: number;
    data?: { custom_id?: string; component_type?: number };
    member?: { user?: { id: string; username?: string } };
    user?: { id: string; username?: string }; // DM context
    id?: string;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  // 1) PING handshake
  if (body.type === PING) {
    return NextResponse.json({ type: PONG });
  }

  // 2) Button clicks
  if (body.type === MESSAGE_COMPONENT) {
    const customId = body.data?.custom_id ?? "";
    const [scope, eventId, action] = customId.split(":");

    if (scope !== "rsvp" || !eventId || !action) {
      return ephemeral("Acción desconocida.");
    }

    const status = action.toUpperCase() as RsvpStatus;
    if (!["GOING", "MAYBE", "DECLINED"].includes(status)) {
      return ephemeral("Estado de RSVP inválido.");
    }

    const discordUserId = body.member?.user?.id ?? body.user?.id;
    if (!discordUserId) {
      return ephemeral("No pude identificarte en Discord.");
    }

    // Map Discord user → HUB user.
    const hubUser = await prisma.user.findUnique({
      where: { discordId: discordUserId },
      select: { id: true, banned: true, nickname: true, discordUsername: true },
    });

    if (!hubUser) {
      return ephemeral(
        "🔒 Tienes que estar logueado en la terminal para interactuar.\n\nEntrá a la web del HUB y autorizá una vez con Discord — después tus votos desde acá quedan registrados automáticamente.",
      );
    }

    if (hubUser.banned) {
      return ephemeral("Tu cuenta está suspendida. No podés votar.");
    }

    // Make sure the event still exists.
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, outcome: true, startsAt: true, restrictedTeams: { select: { id: true } } },
    });
    if (!ev) return ephemeral("Esa operación ya no existe.");

    // Restricted-event guard: voting on a restricted event requires
    // membership in one of the restricted teams.
    if (ev.restrictedTeams.length > 0) {
      const restrictedIds = ev.restrictedTeams.map((t) => t.id);
      const hasAccess = (await prisma.teamSlot.count({
        where: { holderId: hubUser.id, teamId: { in: restrictedIds } },
      })) > 0;
      if (!hasAccess) {
        return ephemeral(
          "🔒 Esta operación es exclusiva para ciertos equipos. No estás en ninguno de ellos.",
        );
      }
    }

    if (ev.outcome !== "PENDING") {
      return ephemeral(
        `Esta operación ya fue marcada como **${ev.outcome}**. RSVPs cerrados.`,
      );
    }

    try {
      await setRsvpFromDiscord(eventId, hubUser.id, status);
    } catch (e) {
      return ephemeral(
        `Error guardando tu voto: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return ephemeral(
      `${RSVP_LABEL[status]} para **${ev.title}**.\nPodés cambiar tu voto en cualquier momento.`,
    );
  }

  // 3) Slash commands (none defined yet — return a friendly error)
  if (body.type === APPLICATION_COMMAND) {
    return ephemeral("Este comando no está implementado todavía.");
  }

  return new NextResponse("unsupported interaction type", { status: 400 });
}

// GET is handy for sanity-checking the route is alive in the browser.
export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "UNSC HUB Discord Interactions",
    publicKeyConfigured: !!process.env.DISCORD_PUBLIC_KEY,
  });
}
