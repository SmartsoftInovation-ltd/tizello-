# Tizello — design system

Tokens were extracted from **trello.com** by computed-style census (Sept 2026)
and reduced to a minimal, standard set.

Everything lives in one file — **`src/app/globals.css`** — as Tailwind v4
`@theme` blocks. Tailwind v4 is CSS-first: there is no `tailwind.config.js`.
Changing a token there changes the utility everywhere.

---

## Provenance

### Kept from Trello

- **The cool-grey neutral ramp.** `#091E42 / #172B4D / #505F79 / #F4F5F7 /
  #FAFBFC` are Trello's actual values, exposed here as `ink-950 … ink-0`. That
  slight blue cast is most of what makes the UI *feel* like Trello.
- **Shadows tinted with `#091E42`** rather than pure black.
- **Board geometry.** A list column is exactly `272px` (`w-list`); cards use an
  8px radius and `shadow-card`.
- **The type scale** — 12 / 14 / 16 / 20 / 24 / 36 / 48 at 400 / 500 / 600 / 700,
  body line-height 1.5.

### Changed

- **Font.** Trello uses Atlassian's proprietary *Charlie Display* / *Charlie
  Text*, served from Atlassian's private DAM CDN and not licensable for this
  project. **Inter** is the substitute — same neutral grotesque skeleton and
  x-height ratio at UI sizes. It is wired in exactly one place:
  `src/app/layout.tsx`. Swapping the typeface is a one-line change there.
- **Brand.** Trello's `#0065FF` blue → fresh mint `#34C77B`.
- **Radii and shadows** collapsed from Trello's ad-hoc set (2 / 3 / 4 / 4.8 /
  8px, six shadow recipes) to four steps each.

---

## Token layers

`src/app/globals.css` is six numbered blocks:

| # | Block | Holds |
| --- | --- | --- |
| 1 | `@theme` | Primitive ramps + scales. **Identical in both themes.** |
| 2 | `@custom-variant dark` | The `dark:` variant definition. |
| 3 | `:root` / `[data-theme]` | Raw semantic values. **This is what flips.** |
| 4 | `@theme inline` | Binds semantic utilities to block 3. |
| 5 | `@layer base` | Element defaults. |
| 6 | `@utility` | Elevation + `scrollbar-board`. |

> **Components reference the semantic layer, not the ramps.**
> Reach for `bg-surface` / `text-text-muted` / `border-border`, not `bg-ink-0` /
> `text-ink-700` / `border-ink-300`. The ramps are for the rare case where a
> specific step *is* the point — a swatch, a label bar, a board background.
>
> This is not style advice: **raw ramp utilities do not flip with the theme.**
> `bg-ink-0` is white in dark mode too.

### Adding a semantic token

Three edits, always in this order:

1. Add the hex to a ramp in block 1 — if it isn't already there.
2. Add `--my-token: light-dark(<light>, <dark>);` to `:root` in block 3.
3. Add `--color-my-token: var(--my-token);` to `@theme inline` in block 4.

Skip step 3 and the utility won't exist. Skip step 2 and it won't theme.

---

## Colour

### Brand — fresh mint

| Token | Value | Use |
| --- | --- | --- |
| `brand-50` | `#e8faf0` | faintest tint |
| `brand-100` | `#c9f3de` | tinted surface, selection |
| `brand-200` | `#9ce8c4` | |
| `brand-300` | `#6bdba7` | |
| `brand-400` | `#47d18f` | hover on solid brand |
| **`brand-500`** | **`#34c77b`** | **identity colour, solid button fill** |
| `brand-600` | `#24a866` | focus ring, board background |
| `brand-700` | `#158049` | brand-coloured **text** on white |
| `brand-800` | `#106138` | text on `brand-100` |
| `brand-900` | `#0b4527` | |
| `brand-950` | `#062b18` | |
| `on-brand` | `#06281a` | ink that sits **on** `brand-500` |

### Neutrals — two ramps

Trello's dark mode is **not** the light ramp inverted; it is a separate, greener
set of greys. Both ship as primitives. `ink-*` runs light-to-dark, `slate-*`
runs dark-to-light, so equivalent roles sit at matching step numbers.

| `ink-*` (light) | | `slate-*` (dark) | | Role |
| --- | --- | --- | --- | --- |
| `ink-0` | `#ffffff` | `slate-0` | `#101214` | app canvas |
| `ink-50` | `#fafbfc` | `slate-50` | `#161a1d` | sunken |
| `ink-100` | `#f4f5f7` | `slate-100` | `#1d2125` | |
| `ink-200` | `#ebecf0` | `slate-200` | `#22272b` | default surface |
| `ink-300` | `#dfe1e6` | `slate-300` | `#282e33` | hover surface |
| `ink-400` | `#c1c7d0` | `slate-400` | `#2c333a` | |
| `ink-500` | `#a5adba` | `slate-500` | `#38414a` | border |
| `ink-600` | `#7a869a` | `slate-600` | `#454f59` | border, strong |
| `ink-700` | `#505f79` | `slate-700` | `#738496` | |
| `ink-800` | `#42526e` | `slate-800` | `#8c9bab` | text, subtle |
| `ink-900` | `#172b4d` | `slate-900` | `#9fadbc` | text, muted |
| `ink-950` | `#091e42` | `slate-950` | `#b6c2cf` | text, primary |

### Semantic aliases

These are the tokens components use. Each resolves per theme.

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `canvas` | `ink-100` | `slate-0` | app background behind surfaces |
| `surface` | `ink-0` | `slate-200` | cards, panels, menus |
| `surface-sunken` | `ink-200` | `slate-50` | wells, empty drop zones |
| `surface-hover` | `ink-100` | `slate-300` | hover on a surface |
| `panel` | `ink-50` | `slate-50` | a grouping box that holds white cards (a sprint, the backlog) — near-white in light so the border, not a grey slab, does the grouping |
| `chip` | `ink-100` | `slate-50` | neutral chips on a card — tags, a gray status, story points; lighter than `surface-sunken` next to 11px text |
| `text` | `ink-900` | `slate-950` | body copy |
| `text-muted` | `ink-700` | `slate-900` | secondary copy |
| `text-subtle` | `ink-600` | `slate-800` | meta, timestamps, placeholders |
| `text-inverse` | `ink-0` | `slate-100` | copy on an inverted fill |
| `text-brand` | `brand-700` | `brand-400` | brand-coloured text (AA-safe both ways) |
| `border` | `ink-300` | `slate-500` | default hairline |
| `border-strong` | `ink-400` | `slate-600` | emphasised divider, input border |
| `focus` | `brand-600` | `brand-400` | the focus ring |
| `scrim` | `ink-950 @ 55%` | `#030404 @ 72%` | the `::backdrop` behind a modal |

### Status

Muted on purpose. **Success reuses the brand ramp** — the brand is already green,
so a second green would read as a bug.

| Token | Light | Dark | | Subtle pair | Light | Dark |
| --- | --- | --- | --- | --- | --- | --- |
| `success` | `#24a866` | `#4bce97` | | `success-subtle` | `#e8faf0` | `#1c3329` |
| `warning` | `#b57f00` | `#f5cd47` | | `warning-subtle` | `#fff7e0` | `#332e1b` |
| `danger` | `#c9372c` | `#f87168` | | `danger-subtle` | `#ffedeb` | `#42221f` |
| `info` | `#1d69d4` | `#579dff` | | `info-subtle` | `#e9f2ff` | `#1c2b41` |
| `accent` | `#5b3fc4` | `#9f8fef` | | `accent-subtle` | `#f3effc` | `#2a2440` |

`accent` is the fifth status hue, added for the Projects screens: *done*,
*held*, *failed* and *active* were covered, a **preparatory** phase was not, and
reusing `info` would have made "Planning" indistinguishable from "In Progress".
Plum is the only hue left unspoken-for. Its primitives are `plum-50 / plum-600 /
plum-900` in block 1; the dark ink reuses `label-purple`.

**A `-subtle` fill does not automatically pair with its own strong token.**
Measured against the values above, at 11px:

| Pair | Light | Dark |
| --- | --- | --- |
| `text-success` on `bg-success-subtle` | 2.82:1 ❌ | 6.80:1 |
| `text-warning` on `bg-warning-subtle` | 3.27:1 ❌ | 8.86:1 |
| `text-info` on `bg-info-subtle` | 4.63:1 | 5.21:1 |
| `text-danger` on `bg-danger-subtle` | 4.57:1 | 5.10:1 |
| **`text-text-muted` on any `-subtle`** | **5.70–6.03:1 ✅** | **5.90–6.44:1 ✅** |

So a status chip takes **neutral ink on a tinted fill**: the hue is carried by
the fill, which is the part that is recognisable at a glance. The strong token
is for dots, ring arcs and bar rails, where the bar is 3:1 — and even there it
must sit on `surface`, not `surface-sunken` (`success` on `surface-sunken` is
2.59:1 in light).

### Card labels

Six desaturated hues — Trello's label row, minimalised. Decorative only; never
the sole carrier of meaning.

`label-green` `#4bce97` · `label-yellow` `#f5cd47` · `label-orange` `#fea362` ·
`label-red` `#f87168` · `label-purple` `#9f8fef` · `label-blue` `#579dff`

---

## Contrast rule — read before using brand colours

`brand-500` (`#34C77B`) is **not** accessible under white text (2.2:1). It is
the identity colour, and it carries **dark** ink.

| Intent | Correct | Ratio |
| --- | --- | --- |
| Solid brand button | `bg-brand-500 text-on-brand` | 7.1:1 ✅ |
| Brand text on white | `text-brand-700` | 5.0:1 ✅ |
| Tinted surface | `bg-brand-100 text-brand-800` | ✅ |
| ~~White on brand~~ | ~~`bg-brand-500 text-white`~~ | 2.2:1 ❌ |

Do not ship the last row. If a design calls for white-on-green, the fill has to
darken to `brand-700` or beyond — which stops reading as mint, so prefer dark
ink instead.

---

## Themes

Three states, set as `data-theme` on `<html>`:

| `<html>` | Result |
| --- | --- |
| *(no attribute)* | follow the OS — the default |
| `data-theme="light"` | force light, even if the OS is dark |
| `data-theme="dark"` | force dark, even if the OS is light |

### How it works

Every themed colour is one `light-dark()` declaration in block 3:

```css
:root {
  color-scheme: light dark;            /* follow the OS unless overridden */
  --surface: light-dark(var(--color-ink-0), var(--color-slate-200));
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }
```

`light-dark()` resolves against the element's computed `color-scheme`, so those
two attribute rules — one declaration each — re-resolve the entire palette.
There is no duplicated dark block to keep in sync, and both values for a token
sit on one line where they can be compared.

Lightning CSS (bundled with Next) downlevels `light-dark()` to a custom-property
shim at build time, so browser support is not a concern. It emits the cascade in
this order, which is what makes a forced theme beat the OS preference:

```
:root                                    → light
@media (prefers-color-scheme: dark) :root → dark
:root[data-theme="light"]                → light   (wins: later + more specific)
:root[data-theme="dark"]                 → dark
```

`box-shadow` has no `light-dark()` equivalent, so the four `--elev-*` tokens are
the one place the dark values are written out in a separate block.

### The switch

| File | Role |
| --- | --- |
| `src/lib/theme.ts` | `Theme` type, the `tizello-theme` cookie read/write, `themeFromCookies` |
| `src/components/ui/theme-toggle.tsx` | the Light / Dark / System control |
| `src/app/layout.tsx` | reads the cookie and stamps `data-theme` on `<html>` |

Two details that are load-bearing:

- **The preference is a cookie, not `localStorage`.** It is sent with the
  document request, so the root layout stamps `data-theme` server-side and the
  right palette is in the first byte of HTML. The alternative — storage plus a
  blocking inline `<script>` in `<head>` — cost a `suppressHydrationWarning`
  and tripped React 19's "Scripts inside React components are never executed
  when rendering on the client" warning, which `next/script` does not avoid
  (it is itself a Client Component).
- **The toggle reads the cookie through `useSyncExternalStore`,** not an effect.
  The server snapshot is `"system"` and the client snapshot is the stored value;
  only the toggle's own highlight reconciles on hydration, since the palette was
  already correct. Reading it in an effect and calling `setState` trips
  `react-hooks/set-state-in-effect`.

Picking **System** clears the cookie and removes the attribute, handing
control back to `color-scheme: light dark`.

### What does not change

The brand ramp and card labels are identical in both themes. `on-brand`
(`#06281A`) clears AA against `brand-500` on either background, so **the primary
button is byte-identical in light and dark** — worth preserving if you restyle
it.

---

## Typography

Inter, via `next/font/google`, exposed as `--font-inter` → `font-sans`.

| Utility | Size / line-height | Use |
| --- | --- | --- |
| `text-2xs` | 11 / 16 | counters, badge meta |
| `text-xs` | 12 / 16 | labels, chips |
| **`text-sm`** | **14 / 20** | **UI default — set on `body`** |
| `text-base` | 16 / 24 | prose, marketing copy |
| `text-lg` | 20 / 28 | list titles |
| `text-xl` | 24 / 32 | section headings |
| `text-2xl` | 30 / 38 | |
| `text-3xl` | 36 / 44 | |
| `text-4xl` | 48 / 56, `-0.02em` | hero |

Weights: 400 body · 500 medium · 600 headings and emphasis · 700 sparingly.
Headings get `tracking-tight` (`-0.01em`) and `ink-950` from the base layer.

**Default body size is 14px, not 16px.** This is a dense app UI.

---

## Radius

| Utility | Value | Use |
| --- | --- | --- |
| `rounded-xs` | 3px | chips, label pills |
| `rounded-sm` | 4px | buttons, inputs |
| `rounded-md` | 8px | cards |
| `rounded-lg` | 12px | lists, panels |
| `rounded-xl` | 16px | modals |

## Elevation

| Utility | Use |
| --- | --- |
| `shadow-card` | Trello's resting-card recipe. **Kanban cards no longer use it** — see below. Keep for anything that genuinely floats a hair off the page. |
| `shadow-raised` | dragged card, hover lift |
| `shadow-overlay` | dropdowns, popovers |
| `shadow-modal` | dialogs |

> **Kanban cards are flat.** A hairline `border-border` and a `surface-hover`
> fill on hover, no shadow — the Notion treatment rather than the Trello one.
> Twenty shadowed cards in a column read as noise; twenty bordered ones read as
> a list. Elevation is reserved for things that actually overlay something else.

In **light** they are tinted `rgba(9, 30, 66, …)` — Trello's own trick, never
pure black. In **dark** a blue-tinted shadow is invisible, so they switch to
near-black `rgba(3, 4, 4, …)` at higher opacity.

These are `@utility` rules, not `--shadow-*` entries in `@theme`. Tailwind bakes
a `@theme` shadow's literal value into the utility, so it could not follow the
theme. Consequence: they don't compose with `shadow-<color>`, which we never do.

## Board geometry

| Utility | Value |
| --- | --- |
| `w-list` | `272px` — Trello's exact list column |
| `w-sidebar` | `256px` |
| `w-rail` | `56px` — the sidebar collapsed to icons |
| `h-topbar` | `48px` |
| `min-h-board` | `416px` — the kanban rail's floor |

`min-h-board` is a drag-and-drop constraint wearing a layout token's clothes. A
rail sized only by its tallest column changes height every time a card crosses
between two — which moves the horizontal scrollbar under the cursor mid-drag
and re-runs the collision that started the move, so the card oscillates. Paired
with `items-stretch` on the rail and `flex-1` on each column's track, every
column is the same height and that height has a floor, so an ordinary drop
changes no box at all. Do not remove it to "let the board hug its content".

The board canvas is neutral (`bg-canvas`) and the column track is untinted.
Colour appears in two small places only: the column's status pill and the
label dots on a card. `--board` / `--on-board` remain defined for brand-tinted
panels — the auth aside in `.claude/specs/authentication.md` uses them — but the
board itself no longer does.

## Motion

`ease-standard` = `cubic-bezier(0.2, 0, 0, 1)`.
Transitions are `duration-100 ease-standard`. Trello's UI is fast and quiet;
keep it that way.

## Utilities

`scrollbar-board` — thin, `ink-400` on transparent. For the horizontal list rail.

---

## House rules

- **No hard-coded colours, radii, shadows, or font sizes in components.** If a
  value isn't a token, add the token first.
- **Never build a class name by interpolation** — `` `bg-brand-${step}` `` will
  not exist. Tailwind scans source as plain text. Write the full class, or map
  to a lookup of complete class strings:
  ```tsx
  const BRAND = [["bg-brand-50", "50"], ["bg-brand-100", "100"]] as const;
  ```
- **One focus treatment.** A 2px `focus` ring is set on `:focus-visible` in the
  base layer. Don't add `focus:` outlines per component, and never `outline-none`
  without a replacement.
- **Add tokens in the right layer.** See *Adding a semantic token* above.
- **Anything with a surface or text colour must use a semantic token.** A raw
  ramp utility (`bg-ink-0`, `text-ink-900`) is frozen in the light palette and
  will be unreadable in dark. The reference page at `/` is the audit: flip to
  dark and anything that stays put is a bug.
- **Reach for `dark:` last.** Semantic tokens flip on their own, so a `dark:`
  utility usually means a token is missing. Add the token instead.

---

## Reference page

`/` renders every token — type scale, both ramps, buttons, radii, elevation, and
a board preview. Keep it in sync when tokens change; delete the route once the
real board UI lands (`src/app/page.tsx`).
