"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDropdownMenu } from "@/components/ui/dropdown-menu-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDownIcon } from "@/components/ui/icons";
import { PersonIcon, SignOutIcon } from "@/components/ui/nav-icons";
import { signOutAction } from "@/lib/actions/auth-actions";
import { initials } from "@/lib/initials";

/**
 * Sign out as a menu item that calls the server action — `DropdownMenuItem`
 * (`ui/dropdown-menu-item.tsx`) only knows `onSelect` and `href`, so this
 * reimplements its exact shape (`role`, `tabIndex`, class) on a `<button>`.
 * Still a POST: a GET would be CSRF-able and prefetchable.
 *
 * WAITS FOR THE API. The item reads "Signing out…" and the menu stays open
 * until `POST /auth/logout` answers: OK redirects to sign-in from the action;
 * anything else closes the menu and toasts why, with the session untouched.
 * The menu must stay mounted meanwhile — the pending state lives in this item.
 */
function SignOutMenuItem() {
  const { closeAndRefocus } = useDropdownMenu();
  const [isPending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const result = await signOutAction();
      if (result?.error) {
        closeAndRefocus();
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={isPending}
      aria-busy={isPending}
      onClick={signOut}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text focus:bg-surface-hover focus:text-text disabled:opacity-60"
    >
      <SignOutIcon className="size-4 shrink-0" />
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}

/**
 * The account control that used to be `SidebarAccount`, pinned to the bottom
 * of the sidebar — now in the top strip beside `ThemeToggle`, per the
 * reference layout. Identity disc with a decorative "online" dot (this app
 * has no presence system; it is always shown, matching the reference rather
 * than claiming a status the app cannot back), a chevron, and a menu holding
 * the name, the way to the profile, and the way out.
 *
 * `avatarSrc` is the profile photo when there is one; the initials underneath
 * are what shows while it loads, if it fails, and for every account that has
 * not set one. `name` here is already the display name — nickname first — so
 * the disc and the menu label agree with what the profile page shows.
 *
 * The outer pill (`border border-border bg-surface`, `my-1.5 p-0.5` for the
 * same "leave the fixed-height strip room to show a real gap" reason as
 * `ThemeToggle` — see that file's header) matches that control's shell so the
 * two read as one family of controls, not two unrelated shapes bolted
 * together. The avatar itself carries its own `border-border` ring, since
 * `bg-surface-sunken` alone doesn't read as a distinct disc against the
 * pill's `bg-surface`.
 */
export function AccountMenuTrigger({
  name,
  avatarSrc,
}: {
  name: string;
  avatarSrc: string | null;
}) {
  return (
    <DropdownMenu className="my-1.5 rounded-full border border-border bg-surface p-0.5">
      <DropdownMenuTrigger
        className="flex items-center gap-1 rounded-full pr-1 transition-colors duration-100 ease-standard hover:bg-surface-hover"
        aria-label={`Account: ${name}. Open menu`}
      >
        <span className="relative inline-flex">
          <Avatar className="size-7 border border-border bg-surface-sunken text-text-muted">
            <AvatarFallback className="text-2xs">
              <span aria-hidden="true">{initials(name)}</span>
            </AvatarFallback>
            {avatarSrc && <AvatarImage src={avatarSrc} alt="" />}
          </Avatar>
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-0 size-2.5 rounded-full bg-success ring-2 ring-surface"
          />
        </span>
        <ChevronDownIcon className="size-3 shrink-0 text-text-muted" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem href="/profile" icon={<PersonIcon className="size-4" />}>
          Go to profile
        </DropdownMenuItem>
        <SignOutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
