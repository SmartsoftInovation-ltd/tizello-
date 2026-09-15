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
