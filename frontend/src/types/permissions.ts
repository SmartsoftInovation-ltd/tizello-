/*
 * The permissions screen's model — now the API's own shapes, not a fixture's.
 *
 * Every type here is exactly what `GET /workspaces/:id/roles` and
 * `GET /workspaces/:id/roles/permissions` return
 * (`backend/docs/api/role.md`). The catalog is SERVED rather than declared in
 * this file, and that is the point: the matrix draws the set the server gates
 * on, so a switch on screen cannot claim a power the backend does not check.
 *
 * A role holds PERMISSION IDS; an action knows nothing about roles. That is
 * what lets a workspace define a role the product has never heard of — the
 * matrix's columns come from the role list, not from a fixed union.
 */

/** The areas the catalog groups actions under. Display order, from the server. */
export type PermissionArea = string;

/** One row of the matrix. */
export type PermissionAction = { id: string; label: string };

/** One area's rows, with the heading the matrix groups them under. */
export type PermissionGroup = {
  area: PermissionArea;
  label: string;
  actions: readonly PermissionAction[];
};

/**
 * The three tiers the schema's `Role` enum holds. A custom role does not
 * replace these — it sits ON one of them (`baseRole`), because `roleAtLeast`
 * still walks MEMBER < ADMIN < OWNER and "Reviewer" is not on that ladder by
 * name.
 */
export const ROLE_TIERS = ["MEMBER", "ADMIN", "OWNER"] as const;
export type RoleTier = (typeof ROLE_TIERS)[number];

export type RoleDefinition = {
  /** A cuid. Built-ins are rows too, so every role has one. */
  id: string;
  name: string;
  /** Which rung of the tier ladder this role sits on. Never OWNER for a custom role. */
  baseRole: RoleTier;
  /**
   * The three roles that ship with the product. Seeded per workspace on first
   * read, and locked: the application code is written against what OWNER means,
   * so they can be read but never renamed, re-scoped or deleted.
   */
  builtIn: boolean;
  /** Permission ids from the catalog. An id that is absent is a denial. */
  permissions: readonly string[];
  /** How many memberships hold it. Served with the list. */
  memberCount?: number;
};

/** What the create and edit dialogs send. */
export type RoleInput = {
  name: string;
  baseRole: RoleTier;
  permissions: readonly string[];
};

export const ROLE_ERROR_COPY: Record<string, string> = {
  VALIDATION_ERROR: "Check the role's name and permissions, then try again.",
  CONFLICT: "A role with that name already exists.",
  FORBIDDEN: "You can't grant a permission you don't hold yourself.",
  NOT_FOUND: "That role no longer exists. Refresh and try again.",
  UNAUTHORIZED: "Your session expired. Sign in again.",
  SERVER_ERROR: "Something went wrong. Try again.",
};

export function roleErrorCopy(code: string): string {
  return ROLE_ERROR_COPY[code] ?? ROLE_ERROR_COPY.SERVER_ERROR;
}
