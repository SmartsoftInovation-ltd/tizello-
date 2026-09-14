import { cookies } from "next/headers";
import { SidebarWorkspaceSlot } from "@/components/layout/sidebar-workspace-slot";
import { workspaceFromCookies } from "@/lib/active-workspace";
import { getWorkspaces } from "@/lib/workspaces";

/**
 * The async seam between the sidebar and the switcher. It exists so `AppSidebar`
 * — and therefore the layouts and pages above it — stay synchronous and can put
 * this behind `<Suspense>`. Without it every route's `loading.tsx` would wait on
 * this fetch before the shell painted at all.
 *
 * `GET /workspaces`, not `demo-data.ts`: the switcher's ids have to be the ids
 * `/workspaces/[workspaceId]` resolves, or every switch lands on a not-found.
 * Archived workspaces are left out — the sidebar is for the ones in play, and
 * `/workspaces?archived=1` is where the rest live.
 */
export async function SidebarWorkspace() {
  const workspaces = await getWorkspaces();
  /* Read here so the switcher renders the remembered workspace in the first
     HTML on routes whose path names none — see `lib/active-workspace.ts`. */
  const storedWorkspaceId = workspaceFromCookies((await cookies()).toString());

  /* The width and the compact flag both depend on whether the sidebar is
     railed, which only a client component can know — see
     `sidebar-workspace-slot.tsx`. */
  return (
    <SidebarWorkspaceSlot workspaces={workspaces} storedWorkspaceId={storedWorkspaceId} />
  );
}
