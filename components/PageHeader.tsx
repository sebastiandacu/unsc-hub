/**
 * UNSC PageHeader — kicker + stamps + huge display title + subtitle + dashed
 * hairline divider. The accent marker on the kicker line is the cobalt
 * signature; the title uses the display font at 4-5rem with negative tracking.
 */
type Stamp = {
  label: string;
  tone?: "default" | "red" | "amber" | "green" | "muted";
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  stamps,
}: {
  /** Small caps line above the title, e.g. "COMUNICACIONES". */
  eyebrow?: string;
  title: string;
  /** Subtitle paragraph in mono, displayed under the title. */
  description?: string;
  /** Right-aligned actions (buttons). */
  action?: React.ReactNode;
  /** Optional stamps shown inline next to the eyebrow. */
  stamps?: Stamp[];
}) {
  return (
    <header className="px-7 pt-7 pb-1 reveal">
      <div className="flex items-center gap-3 mb-3.5 flex-wrap">
        <span className="size-1.5 bg-[var(--color-accent)] shrink-0" />
        {eyebrow && <span className="label-mono-accent">// {eyebrow}</span>}
        {stamps?.map((s, i) => (
          <span
            key={i}
            className={`stamp ${s.tone === "red" ? "stamp-red" : s.tone === "amber" ? "stamp-amber" : s.tone === "green" ? "stamp-green" : s.tone === "muted" ? "stamp-muted" : ""}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-end gap-6 flex-wrap">
        <div className="min-w-0">
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(2.4rem, 5.5vw, 4.6rem)",
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="mt-3 max-w-[70ch]"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-text-dim)",
                letterSpacing: "0.04em",
                lineHeight: 1.6,
              }}
            >
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex gap-2 flex-wrap">{action}</div>}
      </div>

      <hr className="hr mt-5" />
    </header>
  );
}
