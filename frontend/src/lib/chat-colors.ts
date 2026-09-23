/*
 * A person's colour in chat, derived from their id.
 *
 * DERIVED, NOT ASSIGNED. A palette handed out in arrival order would give the
 * same person a different colour in two tabs, a different one again after a
 * reload, and a third when somebody else joined first — which is worse than no
 * colour at all, because by then the reader has learned to use it. Hashing the
 * id is stable everywhere, for free, and needs nothing stored.
 *
 * SHARED so the disc beside a message and the face in the header are the same
 * colour for the same person. Two copies of this table is two places for them
 * to drift, and the drift is invisible until somebody notices Ali is orange in
 * one place and purple in the other.
 *
 * The six hues are the card-label set, which DESIGN-SYSTEM.md marks as
 * decorative and never the sole carrier of meaning — hence a name beside the
 * disc and a `title` on it. Colour here is recognition, not information.
 *
 * The ink is a raw ramp utility on purpose, which the house rule otherwise
 * forbids because ramp values do not flip with the theme. That is exactly why
 * it is right here: `label-*` does not flip either, so fixed dark ink on a
 * fixed pale hue is readable in both themes, where the semantic `text-text`
 * would turn near-white in dark mode and vanish. Same reasoning as
 * `bg-brand-100 text-brand-800`.
 */

const HUES = [
  "bg-label-green",
  "bg-label-yellow",
  "bg-label-orange",
  "bg-label-red",
  "bg-label-purple",
  "bg-label-blue",
] as const;

/** The ink every hue above carries. See the header on why it is a ramp value. */
export const AVATAR_INK = "text-ink-950";

/* Sum of char codes: the ids are cuids, so the tail varies and a sum spreads
   them well enough for six buckets. Not a hash anybody should reuse for
   anything that matters. */
export function avatarHue(seed: string): string {
  let total = 0;
  for (const char of seed) total += char.charCodeAt(0);

  return HUES[total % HUES.length];
}

/** `hue + ink`, which is what every call site actually wants. */
export const avatarTone = (seed: string) => `${avatarHue(seed)} ${AVATAR_INK}`;
