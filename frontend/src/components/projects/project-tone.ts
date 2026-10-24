import type { ProjectPriority, ProjectStatus } from "@/types/project";

/*
 * Every colour the Projects views use, as COMPLETE class strings.
 *
 * Nothing here is built by interpolation — `` `bg-${status}-subtle` `` would
 * not survive Tailwind's plain-text scan of this file, so a status would
 * silently render unstyled. Five lookups, one per role the colour plays.
 *
 * The ink is `text-text-muted` on every chip, and that is the finding rather
 * than a shortcut. Measured against the token values in DESIGN-SYSTEM.md at
 * 11px, a `-subtle` fill does NOT pair with its own strong token:
 *
 *   text-success on bg-success-subtle   2.82:1 light  — fails AA
 *   text-warning on bg-warning-subtle   3.27:1 light  — fails AA
 *   text-info    on bg-info-subtle      4.63:1 light  — passes, barely
 *   text-text-muted on ANY of them      5.70–6.44:1 both themes
 *
 * So the hue is carried by the fill, which is the part that has to be
 * recognisable at a glance, and the ink is the one value that clears AA on all
 * six fills in both themes. The strong tokens still appear — as dots, ring arcs
 * and bar rails, where the bar is 3:1 rather than 4.5:1.
 */

/**
 * Chip fill + soft edge + ink. Composed onto `BADGE_BASE`, which sets no colour.
 *
 * THE BORDER IS THE STRONG TOKEN AT 40%, not a seventh set of tokens. A
 * `-subtle` fill on `surface` is a 1.06:1 edge — the chip has no outline at
 * all, so on a board card it dissolves into the card it sits on. The strong
 * token at full strength is the opposite problem: `border-success` beside
 * `bg-success-subtle` reads as a bordered button rather than a label.
 *
 * `border-success/25` is `color-mix(…, transparent)` over whatever the fill
 * resolves to, so it lands between the two — a green chip whose edge is
 * unmistakably the same green, in both themes, from one declaration. It is
 * DECORATIVE, which is what makes 25% acceptable: the word carries the
 * meaning and the fill carries recognition, so the edge has no 3:1 to clear.
 * The dots and bars below still use the strong token undiluted, because those
 * ARE the indicator.
 *
 * 25% AND NOT 40%: at 40 the hairline was reading as the chip's subject rather
 * than its edge — on a dark surface a 40% amber outline is brighter than the
 * fill it bounds, so an "On hold" chip looked outlined rather than tinted. A
 * quarter strength still names the hue and lets the fill stay the loudest part
 * of the chip.
 *
 * BACKLOG stays neutral, on `border-border` — there is no hue to soften, and
 * the point of the neutral chip is that it is the absence of one.
 */
export const STATUS_CHIP: Record<ProjectStatus, string> = {
  BACKLOG: "border border-border bg-surface-sunken text-text-muted",
  PLANNING: "border border-accent/25 bg-accent-subtle text-text-muted",
  ACTIVE: "border border-info/25 bg-info-subtle text-text-muted",
  ON_HOLD: "border border-warning/25 bg-warning-subtle text-text-muted",
  COMPLETED: "border border-success/25 bg-success-subtle text-text-muted",
  CANCELLED: "border border-danger/25 bg-danger-subtle text-text-muted",
};

/*
 * The 6px disc on a group header, a board column header and a legend row.
 *
 * These must sit on `surface`, never on `surface-sunken`: `success` on
 * `surface-sunken` is 2.59:1 in light and misses the 3:1 a meaningful
 * indicator needs, where on `surface` it is 3.06:1. Every header that uses one
 * is therefore untinted.
 *
 * BACKLOG is the one neutral — `text-subtle` is 3.68:1 on surface, which
 * clears the 3:1 an indicator needs. (`border-strong` is 1.70:1 and is
 * therefore not used for anything that carries meaning.) The set used to hold
 * two greys because the fixture had both BACKLOG and TODO; the API has no
 * TODO, and CANCELLED took the freed slot in `danger`.
 */
export const STATUS_DOT: Record<ProjectStatus, string> = {
  BACKLOG: "bg-text-subtle",
  PLANNING: "bg-accent",
  ACTIVE: "bg-info",
  ON_HOLD: "bg-warning",
  COMPLETED: "bg-success",
  CANCELLED: "bg-danger",
};

/** Donut arcs. Same values as the dots, as SVG strokes. */
export const STATUS_ARC: Record<ProjectStatus, string> = {
  BACKLOG: "stroke-text-subtle",
  PLANNING: "stroke-accent",
  ACTIVE: "stroke-info",
  ON_HOLD: "stroke-warning",
  COMPLETED: "stroke-success",
  CANCELLED: "stroke-danger",
};

/*
 * Timeline bars: a tinted fill for recognition, a hairline in the strong token
 * for the edge. The fill alone would be invisible — `success-subtle` against a
 * white track is 1.06:1 — so the border is what actually bounds the bar, and
 * every one of these clears 3:1 on `surface`.
 */
export const STATUS_BAR: Record<ProjectStatus, string> = {
  BACKLOG: "bg-surface-sunken border-text-subtle",
  PLANNING: "bg-accent-subtle border-accent",
  ACTIVE: "bg-info-subtle border-info",
  ON_HOLD: "bg-warning-subtle border-warning",
  COMPLETED: "bg-success-subtle border-success",
  CANCELLED: "bg-danger-subtle border-danger",
};

/*
 * STATUS_BAR's fill without its edge — a board column's resting tint. Separate
 * rather than derived because `cn` does not merge classes: pairing STATUS_BAR
 * with `border-transparent` would leave the winner to stylesheet order.
 */
export const STATUS_FILL: Record<ProjectStatus, string> = {
  BACKLOG: "bg-surface-sunken",
  PLANNING: "bg-accent-subtle",
  ACTIVE: "bg-info-subtle",
  ON_HOLD: "bg-warning-subtle",
  COMPLETED: "bg-success-subtle",
  CANCELLED: "bg-danger-subtle",
};

/*
 * Priority deliberately avoids `warning`: ON_HOLD already owns amber, and a
 * table showing both columns at once would read as two statements about the
 * same thing. Outline → neutral fill → red fill is a ramp of its own.
 *
 * URGENT and HIGH share the red family and separate by weight rather than hue:
 * a seventh tint would leave the ramp with no visible step, and there is no
 * "more than danger" token. `font-semibold` is already on `BADGE_BASE`, so the
 * distinction is the border — URGENT is the only chip here carrying the strong
 * token at FULL strength, where the status chips above are all softened to a
 * quarter. That is still a visible step when the two columns sit side by side,
 * and it is the one this ramp has left.
 */
export const PRIORITY_CHIP: Record<ProjectPriority, string> = {
  URGENT: "border border-danger bg-danger-subtle text-text-muted",
  HIGH: "border border-danger/25 bg-danger-subtle text-text-muted",
  MEDIUM: "border border-border bg-surface-sunken text-text-muted",
  LOW: "border border-border text-text-muted",
};

/*
 * The `+ New project` box that closes every board column and status group.
 *
 * IT TAKES THE COLUMN'S OWN HUE, softly. The trigger seeds the drawer with the
 * column's status (`new-project-trigger.tsx`), so the control and the column
 * are making the same statement — a neutral grey box in six coloured columns
 * was the one element on the board that did not say which column it belonged
 * to. Soft at rest and firmer on hover: the same quarter/two-thirds pair the
 * chips above use, so a column's add-box and its chips read as one family.
 *
 * The hover FILL is the `-subtle` tint rather than `surface-hover`, which is
 * what makes hovering feel like the column reaching up to meet the pointer.
 *
 * BACKLOG is neutral for the reason it is neutral everywhere else: there is no
 * hue, and inventing one for it would make it look like a seventh status.
 */
export const STATUS_ADD: Record<ProjectStatus, string> = {
  BACKLOG: "border-border hover:border-border-strong hover:bg-surface-hover",
  PLANNING: "border-accent/25 hover:border-accent/60 hover:bg-accent-subtle",
  ACTIVE: "border-info/25 hover:border-info/60 hover:bg-info-subtle",
  ON_HOLD: "border-warning/25 hover:border-warning/60 hover:bg-warning-subtle",
  COMPLETED: "border-success/25 hover:border-success/60 hover:bg-success-subtle",
  CANCELLED: "border-danger/25 hover:border-danger/60 hover:bg-danger-subtle",
};

/** The timeline groups by phase, not by status, so it needs its own three. */
export const PHASE_DOT = {
  TODO: "bg-text-muted",
  IN_PROGRESS: "bg-info",
  COMPLETE: "bg-success",
} as const;
