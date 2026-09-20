import { AppShell } from "@/components/layout/app-shell";

/**
 * Wraps `/my-tasks` — and its `loading` and `error` states — in the app shell,
 * the same way `profile/layout.tsx` wraps that section. The page below renders
 * page content only and does not know the sidebar exists.
 */
export default function MyTasksLayout({ children }: LayoutProps<"/my-tasks">) {
  return <AppShell>{children}</AppShell>;
}
