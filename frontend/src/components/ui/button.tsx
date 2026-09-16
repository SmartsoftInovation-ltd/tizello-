import { cn } from "@/lib/cn";

/**
 * The brand fill, extracted so the primary button and `AuthSubmit` cannot
 * drift apart. `bg-brand-500` carries `text-on-brand` — dark ink at 7.1:1.
 * White on mint is 2.2:1 and must never ship. Hover DEEPENS to `brand-600`
 * rather than lightening, and the press is a 1px drop rather than a third
 * colour.
 */
export const BRAND_FILL =
  "bg-brand-500 text-on-brand transition-[background-color,transform] duration-100 ease-standard hover:bg-brand-600 active:translate-y-px active:bg-brand-600 disabled:pointer-events-none disabled:opacity-60";

const VARIANT = {
  default: BRAND_FILL,
  outline:
    "border border-border bg-surface text-text transition-colors duration-100 ease-standard hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-60",
  /* Ghost with its hover fill kept at rest — the row and sprint kebabs, so the
     control is visibly a button before the pointer finds it. Hover deepens. */
  subtle:
    "bg-surface-hover text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-sunken hover:text-text disabled:pointer-events-none disabled:opacity-60",
  ghost:
    "text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-60",
  /* The destructive confirm. `text-inverse` is the only ink that clears the
     `danger` fill in BOTH themes — white on #c9372c in light, near-black on
     #f87168 in dark. There is no darker danger token to hover to, so the hover
     is a dip in opacity; `disabled:pointer-events-none` means it can never
     fight the disabled dim. */
  danger:
    "bg-danger text-text-inverse transition-[opacity,transform] duration-100 ease-standard hover:opacity-90 active:translate-y-px disabled:pointer-events-none disabled:opacity-60",
} as const;

const SIZE = {
  sm: "h-7 gap-1.5 rounded-sm px-2 text-xs",
  default: "h-9 gap-2 rounded-sm px-3 text-sm",
  icon: "size-9 rounded-sm",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/**
 * The class string on its own, for the cases a `<button>` is the wrong element
 * — a `next/link`, or a menu trigger that owns its own tag.
 */
export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap",
    SIZE[size],
    VARIANT[variant],
    className,
  );
}

/* No `focus:` styles: the 2px ring is set once on :focus-visible in the base
   layer, and one focus treatment is the house rule. */
export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
