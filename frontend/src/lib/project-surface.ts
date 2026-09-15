/**
 * Where the New project form opens: the right-hand drawer, or a centred modal.
 *
 * A preference, not a prop. The drawer is the default because the list behind
 * it is context — on a board you are adding to a column you can still see —
 * but that argument is weaker on a narrow screen and weaker still for someone
 * who wants the form to be the only thing on screen. Both are one `<dialog>`
 * in two positions (`ui/drawer.tsx`), so the choice costs a class string.
 *
 * `localStorage`, not a cookie, and that is the difference from `lib/theme.ts`
 * next door. The theme has to be in the first byte of HTML or the page flashes
 * the wrong palette, which is what makes it worth a cookie on every request.
 * This decides the shape of a panel that is closed on arrival and cannot flash
 * anything, so it stays in the browser where it belongs.
 *
 * Read through `useSyncExternalStore` with `getSurfaceServerSnapshot` as the
 * server value — the same plumbing `ThemeToggle` uses, and for the same
 * reason: reading storage in an effect and calling `setState` trips
 * `react-hooks/set-state-in-effect`, and reading it during render is a
 * hydration mismatch.
 */
export const PROJECT_SURFACES = ["drawer", "modal"] as const;
export type ProjectSurface = (typeof PROJECT_SURFACES)[number];

/*
 * TWO SCOPES. Sprint planning keeps its own preference, defaulting to the
 * centred modal: planning is a screen of stacked boxes the full width of the
 * page, so a side panel covers the very sprint box the task is being planned
 * into, where on the backlog it sits beside a list that is still readable.
 * One shared key would make whichever screen was used last decide for both.
 */
export type SurfaceScope = "default" | "planning";

const STORAGE_KEYS: Record<SurfaceScope, string> = {
  default: "tizello-project-surface",
  planning: "tizello-planning-surface",
};

const DEFAULTS: Record<SurfaceScope, ProjectSurface> = { default: "drawer", planning: "modal" };

/** Same-tab change signal. `storage` only fires in *other* tabs. */
const SURFACE_EVENT = "tizello:projectsurfacechange";

export function isProjectSurface(value: unknown): value is ProjectSurface {
  return (
    typeof value === "string" &&
    (PROJECT_SURFACES as readonly string[]).includes(value)
  );
}

/**
 * The stored preference, or the scope's default. Storage throws outright in some
 * privacy modes. No argument is the default scope — which is what lets this be
 * handed to `useSyncExternalStore` as-is, since React calls it with none.
 */
export function readStoredSurface(scope: SurfaceScope = "default"): ProjectSurface {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS[scope]);
    return isProjectSurface(stored) ? stored : DEFAULTS[scope];
  } catch {
    return DEFAULTS[scope];
  }
}

/** `readStoredSurface` for sprint planning, shaped for `useSyncExternalStore`. */
export const readPlanningSurface = (): ProjectSurface => readStoredSurface("planning");

export function setStoredSurface(surface: ProjectSurface, scope: SurfaceScope = "default") {
  try {
    localStorage.setItem(STORAGE_KEYS[scope], surface);
  } catch {
    /* Blocked or full. The switch still applies for this page view — the event
       below is what actually re-renders the panel. */
  }

  window.dispatchEvent(new Event(SURFACE_EVENT));
}

/* --- useSyncExternalStore plumbing -------------------------------------- */

export function subscribeToSurface(onChange: () => void) {
  window.addEventListener(SURFACE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SURFACE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The server pass has no storage to read, and nothing is visible either way:
 * the panel is closed, so the class string it would have carried was never
 * painted. It reconciles on hydration, long before anyone opens it.
 */
export function getSurfaceServerSnapshot(): ProjectSurface {
  return DEFAULTS.default;
}

export function getPlanningSurfaceServerSnapshot(): ProjectSurface {
  return DEFAULTS.planning;
}

/** The two `useSyncExternalStore` functions for a scope. */
export function surfaceSnapshots(scope: SurfaceScope) {
  return scope === "planning"
    ? { read: readPlanningSurface, server: getPlanningSurfaceServerSnapshot }
    : { read: readStoredSurface, server: getSurfaceServerSnapshot };
}
