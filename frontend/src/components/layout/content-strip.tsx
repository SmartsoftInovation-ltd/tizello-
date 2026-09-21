import { Suspense } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PageLabel } from "@/components/layout/page-label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileSidebarTrigger } from "@/components/layout/sidebar-buttons";

/**
 * The slim strip above the page. The page label on the left, behind the one
 * control that puts the sidebar back: the hamburger, below `md`.
 *
 * There is no expand button here any more. It existed because collapsing HID
 * the sidebar, so the only way back had to live somewhere else; the rail keeps
 * its own toggle, and two controls for one thing in two places is worse than
 * one where it belongs.
 *
 * The label is orientation only — the breadcrumb proper lives in the content
 * column, as the page's heading. The theme control, the notification bell and
 * the account menu sit at the far right; `ml-auto` on that group is what pushes them there. The
 * account menu used to be `SidebarAccount`, pinned to the sidebar's bottom
 * edge; it moved up here to sit beside the theme control, per the reference
 * layout.
 */
export function ContentStrip() {
  return (
    /* `px-4 sm:px-6` mirrors every `<main>` under this shell, so the strip's
       page label and the page's own heading sit on one vertical line rather
       than 4px apart. */
    <div className="flex h-topbar shrink-0 items-center gap-2 border-b border-border px-4 sm:px-6">
      <MobileSidebarTrigger />
      <PageLabel />

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <ThemeToggle />
        {/* Its own boundary, not the account menu's: the bell makes a request
            of its own, and sharing one `Suspense` would hold the avatar behind
            the notification fetch on every page in the shell. */}
        <Suspense fallback={<div className="size-8 animate-pulse rounded-sm bg-surface-sunken" />}>
          <NotificationBell />
        </Suspense>
        <Suspense fallback={<div className="size-8 animate-pulse rounded-full bg-surface-sunken" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </div>
  );
}
