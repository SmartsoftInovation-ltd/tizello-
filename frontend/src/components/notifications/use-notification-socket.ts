"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

/*
 * The realtime half of the bell: one Socket.IO connection per tab, and the
 * only thing it does is tell React to re-read the server.
 *
 * THE EVENT IS A NUDGE, NOT THE DATA. The server sends
 * `notification:new` with a delta and nothing else, and this calls
 * `router.refresh()`. That re-runs the shell's Server Components, so the badge
 * and the list come back from the same fetch that drew them on load. Pushing
 * the row itself would give this screen two sources of truth for one list —
 * and the one that arrived over a socket would be the one nothing revalidated,
 * so it would drift the first time a read or a navigation disagreed with it.
 *
 * AUTHENTICATION IS THE COOKIE, which is why `withCredentials` is set and why
 * nothing here handles a token. `tizello_access` is `httpOnly`; a socket that
 * asked page JavaScript to hand one over would undo the reason it is.
 *
 * THE SERVER HANGS UP WHEN THE TOKEN EXPIRES — five minutes. That is not a
 * failure to recover from, it is the normal case: `router.refresh()` on the
 * reconnect path goes through Next's proxy, which renews the session before
 * the render (`src/proxy.ts`), so the next handshake carries a fresh cookie.
 * Without that refresh the retry would present the same dead token forever.
 *
 * It gives up after a few consecutive auth failures rather than retrying for
 * the life of the tab: at that point the session is genuinely gone, the user
 * is about to be bounced to sign-in by the proxy anyway, and a socket retrying
 * every second is just noise in two logs.
 */

/** The API's own origin — the browser connects to it directly, so this is public. */
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5001";

const MAX_AUTH_RETRIES = 3;

export function useNotificationSocket() {
  const router = useRouter();
  /* A ref, not state: changing it must not re-render the bell, and the
     handlers below need the current value without being re-bound. */
  const authFailures = useRef(0);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      path: "/socket.io",
      withCredentials: true,
      /* WebSocket only. The polling fallback opens a new HTTP request every
         few seconds against an API whose session cookie is rotating, and each
         one is another chance to race the refresh. A browser that cannot do
         WebSockets falls back to the navigation refresh the bell already has. */
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on("connect", () => {
      authFailures.current = 0;
    });

    socket.on("notification:new", () => {
      router.refresh();
    });

    socket.on("connect_error", (error) => {
      if (error.message !== "UNAUTHENTICATED") return;

      authFailures.current += 1;

      if (authFailures.current > MAX_AUTH_RETRIES) {
        socket.disconnect();
        return;
      }

      /* Renews the session through the proxy before the next handshake — see
         the header. */
      router.refresh();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [router]);
}
