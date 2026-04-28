export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel p-12 text-center">
      <div className="label-mono mb-3">// Module pending implementation</div>
      <div className="text-[var(--color-muted)]">{children}</div>
    </div>
  );
}
