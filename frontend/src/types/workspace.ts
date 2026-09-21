/*
 * Workspace domain types. Mirrors the style of `board.ts`: `as const` literal
 * arrays for anything the UI has to switch on, `type` rather than `interface`,
 * and no `any`.
 */

/** Uppercase because that is how a role arrives from an auth/permissions API. */
export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/**
 * The workspace icon's hue. Reuses the six card-label hues rather than adding a
 * seventh scale — they are primitives, legible on both themes, and decorative
 * only. Never the sole carrier of meaning: the name sits next to the disc.
 */
export const WORKSPACE_ACCENTS = [
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "blue",
] as const;
export type WorkspaceAccent = (typeof WORKSPACE_ACCENTS)[number];

/**
 * How `/workspaces` draws the list of workspaces. `grid` is the card wall,
 * `list` the dense table — the same rows, two densities, chosen by `?view=`
 * rather than by a toggle in component state, so a chosen view is linkable and
 * survives a reload. See `lib/workspace-view.ts`.
 */
export const WORKSPACE_VIEWS = ["grid", "list"] as const;
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];

export type Project = {
  id: string;
  name: string;
  /** Absent on a project nobody has described yet. */
  description?: string;
  taskCount: number;
};

/**
 * `slug` through `updatedAt` mirror `backend/docs/api/workspace.md` exactly —
 * every real workspace has them. `memberCount`, `accent` and `projects` are
 * the opposite: fixture-only fields the detail/switcher screens still render
 * from `demo-data.ts`, optional here because no real endpoint populates them
 * yet (there is no project module and no member-count aggregate). A
 * component reading a real, API-sourced `Workspace` must treat all three as
 * absent, not zero/empty — `WorkspaceCard` is the reference for how to
 * degrade when they're missing.
 */
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** A single emoji, or null — never an uploaded image. */
  icon: string | null;
  /** Hex string, e.g. "#6366f1", or null. */
  color: string | null;
  isArchived: boolean;
  /** The CURRENT user's role in this workspace, not the workspace's own. */
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;

  // --- fixture-only, see header note ---
  memberCount?: number;
  accent?: WorkspaceAccent;
  projects?: Project[];
};

export type CurrentUser = {
  id: string;
  name: string;
};

/**
 * One person's membership of one workspace — the `Member` row of the Prisma
 * reference in `.claude/plan/applicaton-flow.md`, flattened with the `User`
 * fields the roster screen renders.
 *
 * Named `WorkspaceMember` because `board.ts` already exports a `Member`: that
 * one is a card assignee (id + name only) and the two must not be conflated.
 *
 * `id` is the membership; `userId` is the person, and is what identifies the
 * signed-in user's own row. There is no avatar field: nothing in this app has
 * an image source, so the discs are initials and a never-rendered `avatarUrl`
 * would be dead weight.
 */
export type WorkspaceMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  /**
   * The TIER — MEMBER, ADMIN or OWNER. Always present, and still what every
   * ladder check reads: a workspace-defined role sits ON a tier rather than
   * replacing it.
   */
  role: WorkspaceRole;
  /**
   * The workspace-defined role they hold, or `null` to fall back to the tier's
   * default grant. `null` rather than absent, so "no custom role" is
   * distinguishable from "this field was not selected".
   */
  roleId?: string | null;
  /** That role's name, for the roster chip. Null when they hold none. */
  roleName?: string | null;
};

/**
 * What `createWorkspaceAction` (and later, an edit action) returns —
 * shaped like `AuthFormState` in `types/auth.ts` for the same reason: a
 * `useActionState` caller needs one serialisable result whether the write
 * succeeded, failed a field, or failed at the form level.
 */
export type WorkspaceFormState = {
  code?: string;
  fieldErrors?: Record<string, string>;
  done?: boolean;
};

/** Copy for the `code`s `lib/workspaces.ts` can return. Unlike `AuthErrorCode`, this is not a closed union — the workspace API's failures are generic HTTP-ish codes, not a fixed enumeration a frontend type needs to track byte-for-byte. */
export const WORKSPACE_ERROR_COPY: Record<string, string> = {
  VALIDATION_ERROR: "Check the fields below.",
  UNAUTHORIZED: "Your session expired. Sign in again.",
  TOKEN_EXPIRED: "Your session expired. Sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "That workspace is no longer available.",
  RATE_LIMITED: "Too many attempts. Try again in a few minutes.",
  SERVER_ERROR: "Something went wrong. Try again.",
};

/** Ownership is transferred, never granted by invitation. */
export const INVITABLE_ROLES = ["ADMIN", "MEMBER"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/**
 * An invitation that has been sent and not yet accepted.
 *
 * Deliberately NOT a `WorkspaceMember`: nobody has accepted, so there is no
 * user id, no name and nothing to draw an avatar from. The address it was sent
 * to is the whole identity, which is why the pending row leads with it.
 *
 * `invitedAt` is an ISO 8601 string rather than a `Date`. It is rendered
 * through `formatDate` with a pinned locale and time zone, so the server and
 * the browser cannot produce different text and trip a hydration mismatch.
 */
export type PendingInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  invitedAt: string;
  /** One value today. Declined and expired invitations are a later screen. */
  status: "PENDING";
};

/** What the accept screen shows someone who followed an invitation link. */
export type WorkspaceInvitation = {
  token: string;
  workspaceId: string;
  workspaceName: string;
  invitedByName: string;
  role: InvitableRole;
};

/**
 * The result of resolving an invitation token — the three responses the
 * eventual `GET /invitations/:token` has to distinguish: 200, 410 Gone for a
 * link that has aged out, 404 for one that never existed or has been consumed.
 */
export type InvitationLookup =
  | { status: "VALID"; invitation: WorkspaceInvitation }
  | { status: "EXPIRED" }
  | { status: "UNKNOWN" };
