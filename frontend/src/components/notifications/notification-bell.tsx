import { NotificationMenu } from "@/components/notifications/notification-menu";
import { getNotifications } from "@/lib/notifications";

/**
 * The bell in the app shell's top strip.
 *
 * A Server Component that does the fetch and hands a plain list to the client
 * leaf below it — so the badge is correct in the first byte of HTML rather
 * than appearing a moment after hydration, and the shell ships no fetching
 * code to the browser.
 *
 * It is wrapped in `<Suspense>` by `ContentStrip`, which is what keeps this
 * request off the critical path of every page under the shell: the strip
 * renders with a placeholder and the bell fills in.
 *
 * IT REFRESHES ON NAVIGATION, not on a timer. The shell re-renders on every
 * route change and the read actions revalidate the layout, so the badge is
 * correct whenever the reader moves or acts. A notification that arrives while
 * they sit still appears on their next click — polling or an event stream is
 * the obvious next step, and neither changes anything below.
 *
 * FIFTEEN, not fifty. The dropdown is a glance at what happened, not an
 * archive — and the count beside it is the real answer to "is there anything
 * new", which the server computes over the whole table rather than over the
 * page.
 */
export async function NotificationBell() {
  const { notifications, unreadCount } = await getNotifications(15);

  return <NotificationMenu notifications={notifications} unreadCount={unreadCount} />;
}
