/**
 * Shared reaction constants. Lives outside `lib/actions/` because files marked
 * "use server" can only export async functions — exporting a plain const from
 * a server-action file throws at runtime ("found object" error).
 */
export const ALLOWED_EMOJIS = ["🎯", "👊", "🔥", "👀", "⚠️", "💀"] as const;
export type Emoji = (typeof ALLOWED_EMOJIS)[number];
