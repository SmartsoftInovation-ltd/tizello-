"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flattenHits, type Hit } from "@/components/search/search-hits";
import { SearchFooter, SearchResultsList } from "@/components/search/search-results-list";
import { SearchIcon } from "@/components/ui/nav-icons";
import { searchAction } from "@/lib/actions/search-actions";
import { getSearchPaletteServerSnapshot, readSearchPaletteOpen, setSearchPaletteOpen, subscribeToSearchPalette } from "@/lib/search-palette";
import { EMPTY_RESULTS, SEARCH_MIN_LENGTH, type SearchResults } from "@/types/search";

/**
 * The ⌘K palette: type, see tasks, projects and sprints from every workspace
 * you belong to, press Enter to go there.
 *
 * MOUNTED ONCE IN `AppShell`, opened through `lib/search-palette.ts` — the
 * sidebar's Search row and the ⌘K listener below are nowhere near each other
 * in the tree, and a store keeps that from becoming a client boundary wrapped
 * around the whole shell to carry one boolean.
 *
 * A NATIVE `<dialog>` with `showModal()`, like `ui/dialog.tsx` and
 * `ui/drawer.tsx`: focus trapping, Esc, inertness behind, and the top layer,
 * with no portal and no dependency.
 *
 * DEBOUNCED AT 250ms, AND THE RESPONSE IS VERSIONED. Every request carries the
 * term it was made for and a late answer is dropped unless it still matches
 * what is in the box — without that, a slow request for "ka" that lands after
 * a fast one for "kanban" repaints the list with the wrong results, which is
 * the classic type-ahead bug and looks exactly like a flaky server.
 *
 * ARROWS WRAP, and Enter opens the highlighted row. The highlight is an INDEX
 * into the flattened hit list, which is the same array the rows render from,
 * so the highlighted row and the opened row cannot drift apart.
 */
const DEBOUNCE_MS = 250;

export function SearchPalette() {
  const open = useSyncExternalStore(subscribeToSearchPalette, readSearchPaletteOpen, getSearchPaletteServerSnapshot);
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  const short = term.trim().length < SEARCH_MIN_LENGTH;
  /* DERIVED, not stored. Below the floor the list is empty because the term is
     too short — not because something emptied it — so there is no state to set
     and nothing to keep in sync. Clearing `results` from the effect instead
     was a synchronous setState in an effect body, which is the cascading
     render `react-hooks/set-state-in-effect` exists to catch. */
  const hits = short ? [] : flattenHits(results);

  /* ⌘K / Ctrl+K anywhere, and it must not fight the browser's own find. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setSearchPaletteOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (open && !element.open) {
      element.showModal();
      inputRef.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  /* The search itself. `ignore` is the versioning: the cleanup runs before the
     next effect, so a response that arrives after the term changed finds its
     own flag already set and writes nothing. */
  useEffect(() => {
    const query = term.trim();
    if (query.length < SEARCH_MIN_LENGTH) return;

    let ignore = false;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const found = await searchAction(query);
        if (!ignore) {
          setResults(found);
          setActive(0);
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  function close() {
    setSearchPaletteOpen(false);
    /* Cleared on close, not on open: a palette that kept the last term would
       show stale results for a heartbeat before the new search landed. */
    setTerm("");
    setResults(EMPTY_RESULTS);
    setActive(0);
  }

  function go(hit: Hit | undefined) {
    if (!hit) return;
    close();
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (hits.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % hits.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + hits.length) % hits.length);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      go(hits[active]);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={close}
      /* Outside-click by rect, the way `ui/drawer.tsx` measures it — a
         keyboard-dispatched click reports 0,0 and must not read as a click in
         the top-left corner. */
      onClick={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || (event.clientX === 0 && event.clientY === 0)) return;
        const inside =
          event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) close();
      }}
      aria-label="Search"
      className="dialog-enter [&:not([open])]:hidden mx-auto mt-[12vh] mb-auto w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface p-0 text-start text-text shadow-modal backdrop:bg-scrim"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <SearchIcon className="size-4 shrink-0 text-text-subtle" />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={onKeyDown}
          type="search"
          placeholder="Search tasks, projects and sprints…"
          aria-label="Search tasks, projects and sprints"
          /* The listbox is `aria-live` below rather than a full combobox: the
             results are links, and announcing the count is what a reader needs
             to know the list changed. */
          className="w-full bg-transparent py-3.5 text-sm text-text outline-none placeholder:text-text-subtle"
        />
        {pending && <span className="shrink-0 text-2xs text-text-subtle">Searching…</span>}
      </div>

      <SearchResultsList hits={hits} active={active} short={short} onGo={go} onHover={setActive} />

      <SearchFooter count={hits.length} />
    </dialog>
  );
}
