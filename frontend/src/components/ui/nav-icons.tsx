import { Icon, type IconProps } from "@/components/ui/icons";

/*
 * The app shell's glyph set — sidebar navigation, the collapse control and the
 * mobile drawer. Same 16px grid, same 1.5 stroke and the same `Icon` wrapper as
 * `icons.tsx`; they are two files only because one would exceed the 150-line
 * cap. Anything a *board* needs belongs next door, not here.
 */

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 7L8 2.5 13.5 7v6a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5z" />
      <path d="M6.5 13.5v-4h3v4" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </Icon>
  );
}

export function ProjectsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2l5.5 3L8 8 2.5 5z" />
      <path d="M2.5 8L8 11l5.5-3" />
      <path d="M2.5 11L8 14l5.5-3" />
    </Icon>
  );
}

export function MembersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <path d="M1.5 13.5a4.5 4.5 0 019 0" />
      <path d="M10.5 4a2.5 2.5 0 010 4.5M11.5 10a4.5 4.5 0 013 3.5" />
    </Icon>
  );
}

/** One person, for the account menu's link to `/profile`. `MembersIcon` is the
 *  two-person glyph and means a roster; this one means you. */
export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="5.5" r="3" />
      <path d="M2.5 14a5.5 5.5 0 0111 0" />
    </Icon>
  );
}

export function BacklogIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
    </Icon>
  );
}

/**
 * A running figure — "sprint" said literally, and distinct at a glance from the
 * Backlog and Planning glyphs beside it, which the old column-board drawing was
 * not. Drawn on the same 16px grid and 1.5 stroke as every icon here: a filled
 * head, a leaning torso, one arm forward and one back, one leg striding and one
 * kicked up behind.
 */
export function SprintIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="2.6" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9 5.25 7.25 9.25" />
      <path d="M9 5.25 6.5 5.75 5 7.5" />
      <path d="M9 5.25l1.5 2.25 2 .25" />
      <path d="M7.25 9.25 9.75 10.5 9.25 13.75" />
      <path d="M7.25 9.25 5.75 11.75 3.25 12" />
    </Icon>
  );
}

export function PlanningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </Icon>
  );
}

export function PanelLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6.5 3v10" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 13.5H3.5a1 1 0 01-1-1v-9a1 1 0 011-1H6" />
      <path d="M10 5.5L12.5 8 10 10.5M12.5 8H6" />
    </Icon>
  );
}
