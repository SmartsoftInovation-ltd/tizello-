import { AppShell } from "@/components/layout/app-shell";

/**
 * Wraps `/trash` — and its `loading` and `error` states — in the app shell,
 * the same way `profile/layout.tsx` wraps that section.
 */
export default function TrashLayout({ children }: LayoutProps<"/trash">) {
  return <AppShell>{children}</AppShell>;
}
