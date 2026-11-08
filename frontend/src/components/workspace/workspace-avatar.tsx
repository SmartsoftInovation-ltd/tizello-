import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { avatarSrc } from "@/lib/profile-display";
import type { WorkspaceAccent } from "@/types/workspace";

/* Complete class strings, never `bg-label-${accent}`. The six label hues are
   theme-invariant primitives, so the disc looks the same in both themes;
   `text-on-brand` is the only dark ink that is also theme-invariant, which is
   what makes it the right pairing here rather than a `text-*` semantic. */
const ACCENT: Record<WorkspaceAccent, string> = {
  green: "bg-label-green text-on-brand",
  yellow: "bg-label-yellow text-on-brand",
  orange: "bg-label-orange text-on-brand",
  red: "bg-label-red text-on-brand",
  purple: "bg-label-purple text-on-brand",
  blue: "bg-label-blue text-on-brand",
};

/* 9px initials in a 20px disc matches `MemberAvatars`. */
const SIZE = {
  sm: { root: "size-5", text: "text-[0.5625rem]" },
  default: { root: "size-8", text: "text-xs" },
  lg: { root: "size-12", text: "text-lg" },
} as const;

/**
 * The workspace's identity disc.
 *
 * Two data sources, in priority order: `color` (a user-picked hex, from the
 * real API) is a genuinely dynamic value, so it is the one exception to
 * "no `style={{}}`" in `.claude/rules/ui-components.md` — there is no finite
 * class to enumerate for an arbitrary hex. `accent` (one of six fixed hues)
 * is the older, fixture-only path and stays available for the still-demo
 * detail/switcher screens. Neither present falls back to a neutral
 * `surface-sunken` disc rather than guessing a colour.
 *
 * `icon` (a single emoji) takes over the glyph slot entirely when present —
 * an emoji the person chose is more identifying than their initials.
 *
 * Decorative by default — unlike `MemberAvatars`, the name is always rendered
 * next to it, so an `sr-only` copy would announce the workspace twice. Pass
 * `label` on the rare occasion the disc stands alone.
 */
export function WorkspaceAvatar({
  name,
  icon,
  imageUrl,
  color,
  accent,
  size = "default",
  label,
  className,
}: {
  name: string;
  icon?: string | null;
  /** An uploaded picture — drawn over the fallback, which stays for a broken image. */
  imageUrl?: string | null;
  color?: string | null;
  accent?: WorkspaceAccent;
  size?: keyof typeof SIZE;
  label?: string;
  className?: string;
}) {
  const src = avatarSrc(imageUrl ?? null);
  const tone = color ? undefined : accent ? ACCENT[accent] : "bg-surface-sunken text-text-muted";

  return (
    <Avatar
      className={cn(SIZE[size].root, className)}
      aria-hidden={label ? undefined : true}
    >
      <AvatarFallback
        className={cn(SIZE[size].text, tone, color && "text-on-brand")}
        style={color ? { backgroundColor: color } : undefined}
      >
        <span aria-hidden="true">{icon || initials(name)}</span>
        {label && <span className="sr-only">{label}</span>}
      </AvatarFallback>
      {src && <AvatarImage src={src} alt="" />}
    </Avatar>
  );
}
