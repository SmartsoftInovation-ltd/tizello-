import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/roles";
import type { WorkspaceRole } from "@/types/workspace";

/**
 * The current user's standing in a workspace. Only ownership earns the brand
 * tint — an "Member" chip on every other card would be noise, so it renders
 * quietly in the default variant.
 */
/** `name` shows a workspace-defined role's own name in place of the tier label. */
export function RoleBadge({ role, name }: { role: WorkspaceRole; name?: string | null }) {
  return (
    <Badge variant={role === "OWNER" ? "brand" : "default"}>
      {name ?? ROLE_LABEL[role]}
    </Badge>
  );
}
