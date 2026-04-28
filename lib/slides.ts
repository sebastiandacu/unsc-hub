/**
 * Normalize a Google Slides URL into an embeddable /embed form.
 * Accepts:
 *   - https://docs.google.com/presentation/d/<ID>/edit?...
 *   - https://docs.google.com/presentation/d/<ID>/pub?...
 *   - https://docs.google.com/presentation/d/<ID>/embed?...
 *   - the raw embed URL
 * Returns null if it doesn't look like a Slides URL.
 */
export function toSlidesEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  const m = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const id = m[1];
  // Preserve querystring options like start, loop, delayms if present in the input.
  const qIndex = url.indexOf("?");
  const qs = qIndex >= 0 ? url.slice(qIndex) : "";
  return `https://docs.google.com/presentation/d/${id}/embed${qs || ""}`;
}
