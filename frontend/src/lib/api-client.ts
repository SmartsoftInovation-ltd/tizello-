import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session-cookie";
import { API_BASE_URL, parseSetCookies } from "@/lib/session-refresh";

/*
 * The one place the frontend talks to the backend.
 *
 * Everything here runs on the SERVER — inside Server Components and Server
 * Actions — never in the browser. That is what lets the session stay in
 * `httpOnly` cookies the page's JavaScript can never read: the browser talks to
 * Next, Next talks to the API, and the token is only ever handled by the half
 * that the browser cannot inspect.
 *
 * Two forwarding problems fall out of that, and both are handled here so no
 * caller has to remember them:
 *
 * 1. **Cookies out.** `fetch` on the server has no cookie jar. Without copying
 *    the incoming `Cookie` header onto the outgoing request, every authenticated
 *    call reaches the API anonymously and 401s, which presents as "signed in,
 *    but nothing loads".
 * 2. **Cookies back.** The API answers sign-in with `Set-Cookie` for
 *    `tizello_access` and `tizello_refresh`. Those headers are on the response
 *    Next received, not on the one the browser gets, so they have to be re-set
 *    through `next/headers` or the session evaporates the moment the action
 *    returns.
 */

const API_BASE = API_BASE_URL;

/** The API's envelope — identical for success and failure. */
export type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
};

/**
 * What every call returns. The error branch carries `code`, not `message`:
 * the UI renders copy from `AUTH_ERROR_COPY` and never shows a server string,
 * so a backend change cannot leak an internal sentence into the page.
 */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; code: string; details?: unknown };

/**
 * Splits a `Set-Cookie` header into individual cookies.
 *
 * A plain `.split(",")` is wrong and fails intermittently: the `Expires`
 * attribute contains a comma (`Expires=Wed, 09 Jun 2027 …`), so naive splitting
 * tears one cookie into two malformed halves. `getSetCookie()` is the correct
 * API and is used when available; this is the fallback, splitting only on a
 * comma that is followed by something shaped like `name=`.
 */
function splitSetCookie(header: string): string[] {
  return header.split(/,(?=\s*[^=;,\s]+\s*=)/);
}

/**
 * Copies the API's `Set-Cookie` headers onto the response Next is building.
 *
 * Parsing — including re-scoping the refresh cookie from the API's
 * `/api/v1/auth/refresh` path to `/` on this origin — is `parseSetCookies` in
 * `lib/session-refresh.ts`, shared with the proxy so the two cannot write the
 * cookie differently. See `lib/session-cookie.ts` for why the path must be `/`.
 */
async function forwardSetCookies(response: Response): Promise<string> {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookie(response.headers.get("set-cookie") ?? "");

  if (raw.length === 0) return "";

  const jar = await cookies();
  const writes = parseSetCookies(raw);

  for (const { name, value, ...options } of writes) {
    try {
      jar.set(name, value, options);
    } catch {
      /* Next only allows a cookie write from a Server Action or Route Handler.
         A renewal fired from a Server *Component* render therefore cannot
         persist the new pair — but it is still valid for the rest of this
         request, which is what the returned header is for. The proxy renews
         ahead of expiry (`proxy.ts`), so this is the rare fallback. Throwing
         here instead would turn "the access token lapsed" into a 500 page. */
    }
  }

  return writes.map(({ name, value }) => `${name}=${value}`).join("; ");
}

type CallOptions = {
  method?: string;
  body?: unknown;
  /**
   * Whether to copy `Set-Cookie` back to the browser. Only sign-in-shaped calls
   * need it, and a Server *Component* cannot set cookies at all — Next throws —
   * so this defaults to false and the actions that need it opt in.
   */
  forwardCookies?: boolean;
  cache?: RequestCache;
  /**
   * Sent instead of this request's own cookies. Used for the one retry after a
   * refresh: the renewed pair may not have been writable to the jar (see
   * `forwardSetCookies`), so the retry has to carry it explicitly or it just
   * replays the expired token and 401s again.
   */
  cookieOverride?: string;
  /** Receives the cookies this response set, as a `Cookie` header value. */
  onCookies?: (header: string) => void;
};

/**
 * Calls the API and normalizes the result.
 *
 * A network failure becomes `SERVER_ERROR` rather than an exception: these run
 * inside Server Actions whose return value is rendered, and an unhandled throw
 * there produces a full error page instead of a form-level message.
 */
export async function apiCall<T>(
  path: string,
  {
    method = "GET",
    body,
    forwardCookies = false,
    cache = "no-store",
    cookieOverride,
    onCookies,
  }: CallOptions = {},
): Promise<ApiResult<T>> {
  const jar = await cookies();

  const cookieHeader =
    cookieOverride ??
    jar
      .getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      // Never cached. A stale hit on this surface means a revoked session still
      // answering — see docs/api/auth.md §Caching.
      cache,
    });
  } catch (error) {
    /* The API is unreachable — wrong port, not started, DNS, TLS. This is the
       single most common cause of a bare "Something went wrong" on screen, and
       swallowing it silently makes it undiagnosable: the UI shows a generic
       sentence and the terminal shows nothing at all. Node nests the useful
       part in `cause` (ECONNREFUSED, EAI_AGAIN), so both are printed. */
    console.error(
      `[api] ${method} ${API_BASE}${path} — request failed:`,
      (error as Error)?.message,
      (error as { cause?: unknown })?.cause ?? "",
    );

    return { ok: false, status: 0, code: "SERVER_ERROR" };
  }

  /* Not `onCookies?.(await forwardSetCookies(response))` — an optional call
     short-circuits its ARGUMENTS as well as the call, so with no `onCookies`
     (every caller but the refresh retry) the forwarding never ran and sign-in
     silently returned no cookies at all. */
  if (forwardCookies) {
    const forwarded = await forwardSetCookies(response);
    onCookies?.(forwarded);
  }

  // 204 has no body; parsing it throws.
  if (response.status === 204) {
    return { ok: true, status: 204, data: undefined as T };
  }

  // Read as text ONCE, then parse that text — never `response.json()` followed
  // by `response.clone()` in the catch. `.json()` disturbs the body stream as
  // it reads, and `Response.clone()` is only legal on a stream nothing has
  // started reading yet: calling it after a failed `.json()` throws its own
  // "Body has already been consumed" TypeError, which then masked the ORIGINAL
  // parse failure and turned a diagnosable 404 into a raw 500 page.
  const raw = await response.text();

  let envelope: ApiEnvelope<T> | null = null;

  try {
    envelope = JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    /* Reached something that is not our API. The giveaway is almost always an
       HTML error page — another service on the port, or a proxy — so the first
       line of the body is logged: it identifies the impostor immediately,
       where "SERVER_ERROR" identifies nothing. */
    console.error(
      `[api] ${method} ${API_BASE}${path} — HTTP ${response.status} but the body is not JSON. ` +
        `Is something else listening on that port? Body starts: ` +
        raw.slice(0, 120).replace(/\s+/g, " "),
    );

    return { ok: false, status: response.status, code: "SERVER_ERROR" };
  }

  if (!response.ok || !envelope?.success) {
    const data = envelope?.data as { code?: string; details?: unknown } | null;

    return {
      ok: false,
      status: response.status,
      // `data.code`, never `error.code` — plan §2.2. Reading the wrong key here
      // yields `undefined`, which falls through every branch in the UI and
      // renders the generic message for errors that had a precise one.
      code: data?.code ?? "SERVER_ERROR",
      details: data?.details,
    };
  }

  return { ok: true, status: response.status, data: envelope.data as T };
}

/**
 * Calls the API and, on any 401, refreshes once and retries once.
 *
 * **Capped at exactly one retry, and that cap is the point.** The classic way
 * this cutover takes a site down is a refresh loop: every request 401s, each one
 * fires a refresh, each refresh 401s, and the app melts down under its own
 * traffic. A second 401 after a successful refresh means the session is genuinely
 * gone, and the caller signs the user out.
 *
 * Every 401 is retried, not only `TOKEN_EXPIRED`. The access token is the short
 * -lived half of the pair, so an expired *or* absent one — the browser drops the
 * cookie at its own max-age, which produces a "no token" 401 rather than an
 * "expired token" one — is exactly the case the refresh token exists to cover.
 * Only the refresh token's own expiry ends the session; the retry cap is what
 * keeps that from looping.
 */
export async function apiCallWithRefresh<T>(
  path: string,
  options: CallOptions = {},
): Promise<ApiResult<T>> {
  const first = await apiCall<T>(path, options);

  if (first.ok || first.status !== 401) {
    return first;
  }

  /* No refresh token, nothing to renew with — this is a signed-out visitor, not
     a lapsed session, and firing the refresh call for them just adds a round
     trip to every anonymous page load. */
  const jar = await cookies();
  if (!jar.has(REFRESH_COOKIE)) return first;

  let renewed = "";
  const refreshed = await apiCall<unknown>("/auth/refresh", {
    method: "POST",
    forwardCookies: true,
    onCookies: (header) => {
      renewed = header;
    },
  });

  if (!refreshed.ok) {
    /* THE SESSION IS OVER. A 401 from the refresh endpoint means the refresh
       token itself is expired, revoked or already spent — there is nothing
       left to renew with, and every later request will 401 identically.
       Dropping both cookies here is what turns that into a sign-in redirect:
       the next request reaches `proxy.ts` with no session cookie, fails its
       gate and is bounced to `/sign-in?next=…`. Left in place, the dead pair
       kept passing the proxy's presence check and the user sat on a page of
       empty data with no way to tell they had been signed out.

       Any other failure — the API unreachable (`status: 0`), a 500, a rate
       limit — must NOT sign anybody out: the token may still be perfectly
       good, and an outage that logs out every user is the worse bug. */
    if (refreshed.status === 401) await clearSessionCookies();
    return first;
  }

  return apiCall<T>(path, { ...options, ...(renewed ? { cookieOverride: renewed } : {}) });
}

/**
 * Deletes both session cookies, if this context is allowed to.
 *
 * Next only permits a cookie write from a Server Action or a Route Handler, so
 * the same call from a Server Component render throws. That is not worth a 500:
 * the render still gets its 401 and the page still redirects on a null session
 * — the deletion is what stops the NEXT request from presenting a token that
 * cannot work, and the proxy will reach the same conclusion on its own.
 */
async function clearSessionCookies(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(ACCESS_COOKIE);
    jar.delete(REFRESH_COOKIE);
  } catch {
    /* Read-only cookie context — see above. */
  }
}

export { API_BASE };
