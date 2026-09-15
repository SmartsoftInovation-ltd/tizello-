import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session-cookie";

/*
 * Renewing the session BEFORE a page renders — the half of the refresh flow
 * that `proxy.ts` runs. Framework-free (no `next/*`), so the proxy bundle stays
 * small and this stays testable.
 *
 * WHY THE PROXY, AND NOT ONLY `apiCallWithRefresh`
 * ------------------------------------------------
 * The API ROTATES the refresh token on every use and treats a spent token
 * presented again as theft, revoking the whole session. A refresh that runs
 * inside a Server Component render gets a new pair it cannot save — Next only
 * allows cookie writes from a Server Action, a Route Handler or the proxy — so
 * the browser kept the spent token, and the next request after the API's
 * 10-second grace window signed the user out. Every page that loads data in
 * parallel made it worse: one expired access token became several refreshes
 * racing each other. That is the "logged out every fifteen minutes" bug.
 *
 * The proxy runs once per request, before any render, and CAN set cookies on
 * both the response (for the browser) and the forwarded request (for this
 * render). Renewing here a minute before the access token lapses means the
 * render's API calls never see a 401 in the ordinary case, and
 * `apiCallWithRefresh` is left as the fallback it was meant to be.
 */

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:5000/api/v1";

/** Renew this long before expiry, so a render that starts just before it cannot straddle it. */
const EXPIRY_MARGIN_MS = 60_000;

export type CookieWrite = {
  name: string;
  value: string;
  path: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

/** The API scopes the refresh cookie to its own `/api/...` path; on this origin it must be `/` — see `lib/session-cookie.ts`. */
const PATH_SCOPED_TO_API = /^\/api\//;

/** Parses `Set-Cookie` lines into writes, re-scoping API paths to `/`. */
export function parseSetCookies(lines: string[]): CookieWrite[] {
  return lines.flatMap((line) => {
    const [pair, ...attributes] = line.split(";");
    const index = pair.indexOf("=");
    if (index < 0) return [];

    const write: CookieWrite = { name: pair.slice(0, index).trim(), value: pair.slice(index + 1).trim(), path: "/" };

    for (const attribute of attributes) {
      const [key, ...rest] = attribute.split("=");
      const flag = key.trim().toLowerCase();
      const detail = rest.join("=").trim();

      if (flag === "path") write.path = PATH_SCOPED_TO_API.test(detail) ? "/" : detail;
      else if (flag === "domain") write.domain = detail;
      else if (flag === "max-age") write.maxAge = Number(detail);
      else if (flag === "expires") write.expires = new Date(detail);
      else if (flag === "httponly") write.httpOnly = true;
      else if (flag === "secure") write.secure = true;
      else if (flag === "samesite") write.sameSite = detail.toLowerCase() as CookieWrite["sameSite"];
    }

    return [write];
  });
}

/**
 * Whether the access token is missing or within a minute of expiry.
 *
 * Reads `exp` WITHOUT verifying the signature — that is fine here and only
 * here: the answer decides whether to ask the API for a new token, never
 * whether to trust this one. A forged `exp` buys nothing but an early refresh.
 */
export function accessTokenNeedsRefresh(token: string | undefined, now = Date.now()): boolean {
  if (!token) return true;

  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp !== "number" || payload.exp * 1000 - now < EXPIRY_MARGIN_MS;
  } catch {
    return true;
  }
}

/**
 * `POST /auth/refresh` with only the refresh cookie. `ok` carries the cookies
 * to set; a replayed response (a concurrent request already rotated this token)
 * carries only the access cookie, which is right — the winner set the refresh.
 * `status: 0` is "the API is unreachable", which must not sign anybody out.
 */
export async function refreshSession(
  refreshToken: string,
): Promise<{ ok: true; cookies: CookieWrite[] } | { ok: false; status: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
      cache: "no-store",
    });

    if (!response.ok) return { ok: false, status: response.status };

    const cookies = parseSetCookies(response.headers.getSetCookie()).filter(
      (cookie) => cookie.name === ACCESS_COOKIE || cookie.name === REFRESH_COOKIE,
    );
    return { ok: true, cookies };
  } catch {
    return { ok: false, status: 0 };
  }
}
