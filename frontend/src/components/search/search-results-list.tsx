"use client";

import type { Hit } from "@/components/search/search-hits";
import { cn } from "@/lib/cn";
import { SEARCH_MIN_LENGTH } from "@/types/search";

/*
 * The palette's result list and its key-hint footer — split from
 * `search-palette.tsx` for the 150-line cap, which is doing its job here: the
 * palette owns the behaviour (the store, the debounce, the keyboard), and
 * these own the markup.
 *
 * `active` is an INDEX into the same flattened array the rows render from, so
 * the highlighted row and the one Enter opens cannot drift apart.
 */

export function SearchResultsList({
  hits,
  active,
  short,
  onGo,
  onHover,
}: {
  hits: Hit[];
  active: number;
  /** The term is below the server's floor — a different state from "no matches". */
  short: boolean;
  onGo: (hit: Hit) => void;
  onHover: (index: number) => void;
}) {
  if (short) {
    return <p className="px-4 py-8 text-center text-xs text-text-subtle">Type at least {SEARCH_MIN_LENGTH} characters.</p>;
  }

  if (hits.length === 0) {
    return <p className="px-4 py-8 text-center text-xs text-text-subtle">Nothing matches that.</p>;
  }

  return (
    <ul className="scrollbar-hidden max-h-[min(24rem,55dvh)] overflow-y-auto py-1" role="listbox" aria-live="polite">
      {hits.map((hit, index) => (
        <li key={hit.id}>
          {/* A heading before the first hit of each group. It is a label, never
              a focusable stop, so the arrow keys keep counting rows and not
              headings — which is why the groups are rendered from the flat
              list rather than from three nested ones. */}
          {(index === 0 || hits[index - 1].group !== hit.group) && (
            <p className="px-4 pt-2 pb-1 text-2xs font-semibold tracking-widest text-text-subtle uppercase">{hit.group}</p>
          )}

          <button
            type="button"
            role="option"
            aria-selected={index === active}
            /* Hover moves the highlight so the pointer and the keyboard share
               one selection — otherwise Enter opens a row the mouse is not on. */
            onMouseEnter={() => onHover(index)}
            onClick={() => onGo(hit)}
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors duration-100 ease-standard",
              index === active ? "bg-surface-hover" : "hover:bg-surface-hover",
            )}
          >
            {hit.icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text">{hit.label}</span>
              <span className="block truncate text-2xs text-text-subtle">{hit.meta}</span>
            </span>
            {hit.badge}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SearchFooter({ count }: { count: number }) {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-border bg-panel px-4 py-2 text-2xs text-text-subtle">
      <span>
        <Key>↑</Key> <Key>↓</Key> to move &middot; <Key>↵</Key> to open &middot; <Key>Esc</Key> to close
      </span>
      <span className="tabular-nums">{count > 0 && `${count} results`}</span>
    </footer>
  );
}

/** `font-sans` on purpose — the UA styles `<kbd>` as monospace, which is a second typeface for four glyphs. */
function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-xs border border-border bg-surface px-1 font-sans text-2xs text-text-muted">{children}</kbd>;
}
