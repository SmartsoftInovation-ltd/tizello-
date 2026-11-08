/**
 * One cell of the sprint progress strip: a label row, a 6px bar, a caption row.
 * Work and Time are both built from this, so their bars sit on one line.
 */
export function ProgressCell({
  label,
  value,
  children,
  caption,
}: {
  label: string;
  value: React.ReactNode;
  children: React.ReactNode;
  caption: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xs font-semibold tracking-widest text-text-subtle uppercase">{label}</p>
        <p className="truncate text-xs text-text-muted tabular-nums">{value}</p>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-hover">{children}</div>
      <div className="mt-2 flex min-h-4 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">{caption}</div>
    </div>
  );
}
