/*
 * Whether the search palette is open — kept out of React, the same shape
 * `sidebar.ts` uses for the mobile drawer: a read, a server snapshot, a writer
 * and a subscribe, which is what `useSyncExternalStore` needs.
 *
 * NO PROVIDER, ON PURPOSE. The palette is opened from two places that are not
 * anywhere near each other in the tree — the sidebar's Search row and a ⌘K
 * anywhere on the page — and the panel itself is mounted once in `AppShell`.
 * Threading state between those through context would mean a client boundary
 * wrapped around the whole shell to carry one boolean.
 *
 * Never persisted. A palette that reopened itself on the next page load would
 * be a modal nobody asked for.
 */

const EVENT = "tizello:searchpalette";

let open = false;

export function readSearchPaletteOpen(): boolean {
  return open;
}

/** The server cannot have a palette open, and must not render one. */
export function getSearchPaletteServerSnapshot(): boolean {
  return false;
}

export function setSearchPaletteOpen(next: boolean) {
  /* Guarded so a no-op — ⌘K while it is already open — does not wake every
     subscriber, and does not remount the panel out from under the text
     someone has half-typed into it. */
  if (open === next) return;
  open = next;
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeToSearchPalette(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
