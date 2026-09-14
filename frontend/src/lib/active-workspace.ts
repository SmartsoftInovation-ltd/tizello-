/**
 * The workspace somebody last had open, for the screens whose URL carries none.
 *
 * `/workspaces/[workspaceId]/…` names its workspace in the path, and that is
 * still the authority wherever it exists. `/board/*` does not, so reading the
 * active workspace from the path alone made the sidebar switcher fall back to
 * "Workspaces" the moment you opened the backlog — as if the choice had been
 * undone. This remembers the last one instead.
 *
 * A cookie rather than `localStorage`, for the reason `theme.ts` gives: the
 * server can read it, so the switcher is right in the first HTML and the
 * backlog can default to a project in that workspace.
 */
export const WORKSPACE_COOKIE = "tizello-workspace";

/** A year, like the theme — it is a preference, not a session. */
const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Same-tab change signal. `storage` only fires in *other* tabs. */
const WORKSPACE_EVENT = "tizello:workspacechange";

/**
 * Picks the remembered id out of a raw `Cookie` header value. Pure, so the
 * server and the browser share one parser.
 */
export function workspaceFromCookies(header: string | undefined): string | undefined {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${WORKSPACE_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** Reads the remembered id. `undefined` if unset or cookies are unavailable. */
export function readStoredWorkspace(): string | undefined {
  try {
    return workspaceFromCookies(document.cookie);
  } catch {
    return undefined;
  }
}

/** Remembers a workspace. A no-op when it is already the remembered one. */
export function rememberWorkspace(workspaceId: string) {
  if (readStoredWorkspace() === workspaceId) return;

  try {
    document.cookie = `${WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; path=/; max-age=${WORKSPACE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* cookies disabled — the path-derived workspace still works where it exists */
  }

  window.dispatchEvent(new Event(WORKSPACE_EVENT));
}

/* --- useSyncExternalStore plumbing -------------------------------------- */

export function subscribeToWorkspace(onChange: () => void) {
  window.addEventListener(WORKSPACE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(WORKSPACE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
