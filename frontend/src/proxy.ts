import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session-cookie";
import { accessTokenNeedsRefresh, refreshSession } from "@/lib/session-refresh";

/*
 * Route protection and session renewal (Next 16 renamed middleware to proxy).
 *
 * 1. RENEW. When the access token is missing or about to lapse and a refresh
 *    token is present, the session is renewed HERE, once, before anything
 *    renders — the new cookies go to the browser on the response and to this
 *    request's render on the forwarded headers. `lib/session-refresh.ts` says
 *    why this cannot be left to the render: a refresh there rotates a token the
 *    browser never learns about, and the API then treats the next request as
 *    theft and ends the session.
 *
 * 2. GATE. Otherwise this is an optimistic check and nothing more: the
 *    *presence* of a session cookie lets the request through, and real
 *    validation happens in the page, where `getSession()` resolves it to a user.
 *    Treating a proxy check as authorisation would be a mistake — a cookie with
 *    any value at all passes here.
 */
export async function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken && accessTokenNeedsRefresh(request.cookies.get(ACCESS_COOKIE)?.value)) {
    const renewed = await refreshSession(refreshToken);

    if (renewed.ok) {
      for (const cookie of renewed.cookies) request.cookies.set(cookie.name, cookie.value);
      const response = NextResponse.next({ request: { headers: request.headers } });
      for (const { name, value, ...options } of renewed.cookies) response.cookies.set(name, value, options);
      return response;
    }

    /* The API refused the refresh token: the session is over. Drop both cookies
       so this request is gated as signed out below and the browser stops
       re-presenting a token that will never work. An unreachable API (status 0)
       changes nothing — an outage must not sign anyone out. */
    if (renewed.status === 401) {
      request.cookies.delete(ACCESS_COOKIE);
      request.cookies.delete(REFRESH_COOKIE);
    }
  }

  if (request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE)) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  /* A Server Action POST is not a navigation, and redirecting one hands React
     an HTML sign-in page where it expects a Flight stream — which surfaces as
     the opaque "An unexpected response was received from the server" runtime
     error rather than a sign-in bounce. Let it through instead: the action's
     own API call 401s, returns a code, and the caller renders that. */
  if (request.headers.has("next-action")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  /* Where they were going, so signing in returns them there. Set through
     searchParams so the value is encoded once and cannot smuggle a second
     parameter; `safeNextPath` rejects anything that is not a relative path
     when it is read back. */
  url.searchParams.set("next", request.nextUrl.pathname);

  const redirect = NextResponse.redirect(url, 307);
  if (refreshToken) {
    redirect.cookies.delete(ACCESS_COOKIE);
    redirect.cookies.delete(REFRESH_COOKIE);
  }
  return redirect;
}

export const config = {
  // `/workspaces` joined `/board` here once its data stopped being a fixture:
  // an unauthenticated call to the real API 401s, and without this guard that
  // read as "you have zero workspaces" instead of a sign-in redirect.
  // `/profile` for the same reason — it reads the session's own record.
  matcher: ["/board/:path*", "/workspaces/:path*", "/profile/:path*"],
};
