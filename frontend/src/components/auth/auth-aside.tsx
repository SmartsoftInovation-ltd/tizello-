import InkOrbitFeatures from "@/components/ui/ink-orbit-features";

/*
 * The right half of the split shell: the brand gradient field
 * (`auth-field` + `auth-noise` in globals.css) with a live features section on
 * top — `InkOrbitFeatures` in Tizello's green (`tone="brand"`), showing what
 * the product does while someone signs in.
 *
 * The headline changes per route; the four feature cards describe Tizello
 * itself. Each page passes its own `variant` rather than this reading the
 * route, which keeps the layout out of the client bundle — the features
 * section is the client leaf, not the shell around it.
 *
 * Removed entirely below `lg` rather than stacked — nobody should scroll past
 * decoration to reach a login form. It scrolls inside itself on short screens.
 */
const COPY = {
  "sign-in": { tag: "Welcome back", title: "Your work,\n*right where you left it*" },
  "sign-up": { tag: "Get started", title: "Organise *anything*\nwith your team" },
  "forgot-password": { tag: "Everyone forgets", title: "Back on the board\n*in under a minute*" },
  "reset-password": { tag: "A clean slate", title: "New password,\n*same workspace*" },
  "verify-email": { tag: "Almost there", title: "One click\n*and you're in*" },
  invite: { tag: "You're invited", title: "Someone saved\n*you a seat*" },
} as const;

export type AuthAsideVariant = keyof typeof COPY;

const FEATURES = {
  collaboration: {
    title: "Real-time collaboration",
    description: "Chat, comments and live boards keep the whole team on the same sprint.",
  },
  reports: {
    title: "Sprint breakdowns",
    description: "Status share, workload and timeline charts build themselves from your tasks.",
  },
  integrations: {
    title: "Everything connected",
    description: "Backlog, sprints, chat and search share one workspace — no tab-hopping.",
    tools: ["Backlog", "Sprints", "Chat", "Search"],
  },
  insights: {
    title: "Sprint progress",
    description: "See points done against time left, and where the sprint is heading.",
  },
};

export function AuthAside({ variant }: { variant: AuthAsideVariant }) {
  const { tag, title } = COPY[variant];

  return (
    <aside className="auth-field relative hidden overflow-y-auto lg:flex lg:items-center">
      <div className="auth-noise pointer-events-none absolute inset-0" aria-hidden="true" />

      <InkOrbitFeatures
        tone="brand"
        brand="Tizello"
        tag={tag}
        title={title}
        {...FEATURES}
        className="relative"
      />
    </aside>
  );
}
