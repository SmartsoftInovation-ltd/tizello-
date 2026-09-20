import type { StatusColor } from "@/types/task";

/*
 * Every colour a status can be drawn in, as complete class strings — never
 * interpolated, for the reason `project-tone.ts` gives.
 *
 * The hues are the `label-*` primitives: decorative, identical in both themes,
 * and already the app's "a colour somebody picked" palette. A chip is that hue
 * as a 20% tint with a 40% edge, carrying `text-text` — the tint sits over
 * `surface` in either theme, so the ink the surface already clears is the ink
 * the chip clears. The word carries the meaning; the colour is recognition.
 *
 * Gray is the one neutral and uses the semantic layer, because a 20% tint of a
 * grey is just a dirtier surface.
 */
export const STATUS_CHIP: Record<StatusColor, string> = {
  gray: "border border-border bg-chip text-text-muted",
  brown: "border border-label-brown/40 bg-label-brown/20 text-text",
  orange: "border border-label-orange/40 bg-label-orange/20 text-text",
  yellow: "border border-label-yellow/40 bg-label-yellow/20 text-text",
  green: "border border-label-green/40 bg-label-green/20 text-text",
  blue: "border border-label-blue/40 bg-label-blue/20 text-text",
  purple: "border border-label-purple/40 bg-label-purple/20 text-text",
  pink: "border border-label-pink/40 bg-label-pink/20 text-text",
  red: "border border-label-red/40 bg-label-red/20 text-text",
};

/*
 * A whole board card washed in the colour of the status it sits in, so a
 * glance down the rail reads as blocks of colour and a card that has crossed
 * into another column is obvious before the title is.
 *
 * FAR fainter than `STATUS_CHIP`. A chip is two words on a 20% tint; a card is
 * a paragraph, meta and avatars on the same fill, so the wash drops to ~15%
 * at the top fading to ~8% at the bottom, with a 35% edge. Ink stays `text`
 * and `text-subtle`: the wash is light enough over `surface` in either theme
 * that the contrast the plain card cleared is the contrast this one clears.
 *
 * THE TINT IS A GRADIENT OVER `bg-surface`, NOT A TRANSLUCENT FILL. Tailwind's
 * `from-*`/`to-*` paint a background *image*, which composites over the opaque
 * `surface` underneath — so the card is still solid when the drag overlay
 * carries it across the board. A plain `bg-label-green/15` would have let
 * whatever it flew over show through the text.
 *
 * Gray stays the untinted surface, for the reason `STATUS_CHIP` gives: a tint
 * of grey is just a dirty card.
 */
export const STATUS_CARD: Record<StatusColor, string> = {
  gray: "border-border bg-surface hover:border-border-strong hover:bg-surface-hover",
  brown:
    "border-label-brown/35 bg-surface bg-linear-to-b from-label-brown/15 to-label-brown/8 hover:border-label-brown/55 hover:from-label-brown/25 hover:to-label-brown/15",
  orange:
    "border-label-orange/35 bg-surface bg-linear-to-b from-label-orange/15 to-label-orange/8 hover:border-label-orange/55 hover:from-label-orange/25 hover:to-label-orange/15",
  yellow:
    "border-label-yellow/35 bg-surface bg-linear-to-b from-label-yellow/15 to-label-yellow/8 hover:border-label-yellow/55 hover:from-label-yellow/25 hover:to-label-yellow/15",
  green:
    "border-label-green/35 bg-surface bg-linear-to-b from-label-green/15 to-label-green/8 hover:border-label-green/55 hover:from-label-green/25 hover:to-label-green/15",
  blue: "border-label-blue/35 bg-surface bg-linear-to-b from-label-blue/15 to-label-blue/8 hover:border-label-blue/55 hover:from-label-blue/25 hover:to-label-blue/15",
  purple:
    "border-label-purple/35 bg-surface bg-linear-to-b from-label-purple/15 to-label-purple/8 hover:border-label-purple/55 hover:from-label-purple/25 hover:to-label-purple/15",
  pink: "border-label-pink/35 bg-surface bg-linear-to-b from-label-pink/15 to-label-pink/8 hover:border-label-pink/55 hover:from-label-pink/25 hover:to-label-pink/15",
  red: "border-label-red/35 bg-surface bg-linear-to-b from-label-red/15 to-label-red/8 hover:border-label-red/55 hover:from-label-red/25 hover:to-label-red/15",
};

/*
 * A whole board COLUMN washed in its status's hue — the box the cards sit in,
 * headed by that status's pill.
 *
 * Fainter still than `STATUS_CARD` (12% fading to 4%), and that gap is the
 * point: the column is `panel` and the card is `surface`, which is already the
 * lighter of the two in both themes, so a card stays a distinct object on a
 * tinted column instead of dissolving into it. Tint them equally and the board
 * turns into five flat colour fields.
 *
 * NO OUTLINE — the fill alone is the box, which is what a borderless column
 * asks for: `panel` is lighter than `canvas` in both themes, so the edge reads
 * without a line drawn around it. `border-transparent` rather than no border
 * at all, because the drag states DO draw one and the box must not resize by a
 * pixel the moment a column is picked up.
 *
 * Same gradient-over-an-opaque-base trick as `STATUS_CARD`, for the same
 * reason — a column travels too, under `ColumnDragPreview`.
 */
export const STATUS_COLUMN: Record<StatusColor, string> = {
  gray: "border-transparent bg-panel",
  brown: "border-transparent bg-panel bg-linear-to-b from-label-brown/12 to-label-brown/4",
  orange: "border-transparent bg-panel bg-linear-to-b from-label-orange/12 to-label-orange/4",
  yellow: "border-transparent bg-panel bg-linear-to-b from-label-yellow/12 to-label-yellow/4",
  green: "border-transparent bg-panel bg-linear-to-b from-label-green/12 to-label-green/4",
  blue: "border-transparent bg-panel bg-linear-to-b from-label-blue/12 to-label-blue/4",
  purple: "border-transparent bg-panel bg-linear-to-b from-label-purple/12 to-label-purple/4",
  pink: "border-transparent bg-panel bg-linear-to-b from-label-pink/12 to-label-pink/4",
  red: "border-transparent bg-panel bg-linear-to-b from-label-red/12 to-label-red/4",
};

/** The dot inside a chip, and the swatch in the colour picker — the hue at full strength. */
export const STATUS_DOT: Record<StatusColor, string> = {
  gray: "bg-text-subtle",
  brown: "bg-label-brown",
  orange: "bg-label-orange",
  yellow: "bg-label-yellow",
  green: "bg-label-green",
  blue: "bg-label-blue",
  purple: "bg-label-purple",
  pink: "bg-label-pink",
  red: "bg-label-red",
};

/*
 * The hue as an SVG stroke — the breakdown donut's arcs.
 *
 * A separate record rather than a swap on `STATUS_DOT`, for the reason every
 * lookup in this file exists: `` `stroke-${color}` `` compiles to nothing.
 * Tailwind scans source as plain text and has no idea what `color` holds.
 */
export const STATUS_STROKE: Record<StatusColor, string> = {
  gray: "stroke-text-subtle",
  brown: "stroke-label-brown",
  orange: "stroke-label-orange",
  yellow: "stroke-label-yellow",
  green: "stroke-label-green",
  blue: "stroke-label-blue",
  purple: "stroke-label-purple",
  pink: "stroke-label-pink",
  red: "stroke-label-red",
};
