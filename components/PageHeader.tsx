export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="relative border-b border-[var(--color-border)] px-8 py-7 overflow-hidden">
      {/* decorative corner ticks */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[var(--color-accent)]" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[var(--color-accent)]" />

      <div className="flex items-end justify-between gap-6 reveal">
        <div className="min-w-0">
          {eyebrow && (
            <div className="label-mono mb-3 flex items-center gap-2">
              <span className="size-1 bg-[var(--color-accent)]" />
              {eyebrow}
            </div>
          )}
          <h1
            className="display-lg text-balance"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-sm text-[var(--color-text-dim)] max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
