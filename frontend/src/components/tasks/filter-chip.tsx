import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * One choice in the filter dialog — a toggle chip. Pressed takes the brand
 * tint and a check; at rest it carries `surface-hover`, the app's rest fill for
 * controls, so every choice reads as clickable before the pointer finds it.
 * `aria-pressed` because each chip is an on/off switch, and clicking the
 * chosen one clears it.
 */
export function FilterChip({
  label,
  selected,
  adornment,
  onToggle,
}: {
  label: string;
  selected: boolean;
  adornment?: React.ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-sm border px-2 text-xs font-medium transition-colors duration-100 ease-standard",
        selected
          ? "border-brand-500 bg-brand-100 text-brand-800"
          : "border-transparent bg-surface-hover text-text-muted hover:bg-surface-sunken hover:text-text",
      )}
    >
      {adornment}
      <span className="min-w-0 truncate">{label}</span>
      {selected && <CheckIcon className="size-3 shrink-0" />}
    </button>
  );
}
