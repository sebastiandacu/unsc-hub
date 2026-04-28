/**
 * Plain @mention extraction + fan-out for Tiptap docs.
 *
 * Recognises:
 *   @everyone               → notifies every active user
 *   @<nickname or discord>  → resolves to a User and notifies them
 *
 * Tokens: alphanumerics, underscore, dot, dash. Matches case-insensitively.
 * Lookups are deduped, exclude the author, and never throw — best-effort.
 */

import { prisma } from "@/lib/db";
import { notify, notifyAllUsers } from "@/lib/notify";

const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_.\-]{2,32})/g;

function walkText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof n.text === "string") out.push(n.text);
  if (Array.isArray(n.content)) for (const c of n.content) walkText(c, out);
}

export function extractMentionTokens(doc: unknown): { everyone: boolean; usernames: string[] } {
  const buf: string[] = [];
  walkText(doc, buf);
  const text = buf.join(" \n ");
  const usernames = new Set<string>();
  let everyone = false;
  for (const m of text.matchAll(MENTION_RE)) {
    const tok = m[2].toLowerCase();
    if (tok === "everyone" || tok === "all" || tok === "here") everyone = true;
    else usernames.add(tok);
  }
  return { everyone, usernames: [...usernames] };
}

export type MentionContext = {
  authorId: string;
  authorName: string;
  /** What kind of content the mention is in — "bulletin", "thread", "reply". */
  surface: "bulletin" | "thread" | "reply";
  title: string;
  url: string;
};

export async function fanOutMentions(doc: unknown, ctx: MentionContext): Promise<void> {
  const { everyone, usernames } = extractMentionTokens(doc);
  if (!everyone && usernames.length === 0) return;

  const surfaceLabel =
    ctx.surface === "bulletin" ? "bulletin" : ctx.surface === "thread" ? "thread" : "reply";
  const baseTitle = `📣 ${ctx.authorName} te mencionó en ${surfaceLabel}`;
  const baseBody = ctx.title;

  if (everyone) {
    await notifyAllUsers(
      {
        kind: "mention.everyone",
        title: `📣 @everyone — ${ctx.authorName}`,
        body: ctx.title,
        url: ctx.url,
      },
      ctx.authorId,
    );
    // @everyone supersedes individual lookups for this surface
    return;
  }

  // Resolve usernames against nickname OR discordUsername (case-insensitive).
  const candidates = await prisma.user.findMany({
    where: {
      banned: false,
      OR: usernames.flatMap((u) => [
        { nickname: { equals: u, mode: "insensitive" as const } },
        { discordUsername: { equals: u, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true },
  });
  const targetIds = [...new Set(candidates.map((c) => c.id))].filter((id) => id !== ctx.authorId);
  if (targetIds.length === 0) return;
  await Promise.all(
    targetIds.map((userId) =>
      notify(userId, {
        kind: "mention.user",
        title: baseTitle,
        body: baseBody,
        url: ctx.url,
      }),
    ),
  );
}
