// The single source of truth for workspace roles and what each one may do.
// Both the permission middleware (shared/middlewares/permission.js) and any
// service that needs an authorization decision read from here — no module
// hard-codes a role string or an `if (role === 'ADMIN')` check of its own.
//
// ROLES' string values must stay in sync with the `Role` enum in
// prisma/schema.prisma: they are written to and read back from Postgres.

const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
};

// Ordered least → most privileged. Used by `roleAtLeast` below for the
// common "ADMIN or above" style check, where enumerating every permission
// would be noise.
const ROLE_ORDER = [ROLES.MEMBER, ROLES.ADMIN, ROLES.OWNER];

// Every permission the app can check, as a dotted `area.action` id. Add new
// ones here first, then grant them in ROLE_PERMISSIONS below — a permission
// that is checked but never listed always denies, which is the safe direction.
//
// THE IDS ARE PRODUCT-FACING AND THAT IS DELIBERATE. They are served to the
// browser by `GET /workspaces/:id/permissions` and are what a workspace ticks
// when it defines a role, so the grid a person sees and the set the server
// gates on are the same strings. They were `workspace:update` style before
// custom roles; renaming them to match the screen is what makes "the matrix IS
// the enforcement" true rather than aspirational.
const PERMISSIONS = {
  WORKSPACE_VIEW: 'workspace.view',
  WORKSPACE_UPDATE: 'workspace.edit',
  WORKSPACE_DELETE: 'workspace.delete',
  MEMBER_VIEW: 'members.view',
  MEMBER_INVITE: 'members.invite',
  MEMBER_REMOVE: 'members.remove',
  MEMBER_ROLE_UPDATE: 'members.roles',
  PROJECT_VIEW: 'projects.view',
  PROJECT_CREATE: 'projects.create',
  // The workspace-admin escape hatch, expressed as a permission rather than a
  // `role === 'ADMIN'` check inside the project module: without it an admin can
  // be locked out of a project inside their own workspace by a collaborator who
  // removes them, and the only recovery is direct database access. See
  // .claude/plan/project.md §2.5.
  PROJECT_MANAGE_ANY: 'projects.manage',
  // Defining the workspace's own roles. Separate from MEMBER_ROLE_UPDATE on
  // purpose: assigning someone an existing role and authoring a new one are
  // different powers, and a workspace that wants delegated administration
  // without letting anyone mint capabilities needs to grant one and not the
  // other.
  ROLE_MANAGE: 'roles.manage',
};

// The catalog the roles screen draws, grouped the way it groups them. Served
// as-is by `GET /workspaces/:id/permissions`, so the columns of the matrix and
// the keys of the grant table cannot drift apart.
//
// EVERY ROW HERE IS ENFORCED SOMEWHERE, and that invariant is the point of the
// catalog: it is served to the browser and drawn as a grid of switches, so a
// row nothing checks is a control that lies. `workspace.billing` was in this
// list and had zero call sites — the schema carries `plan`/`seatLimit` columns
// for a billing feature that does not exist yet — so it is gone until there is
// something to gate. `workspace.view` was in the same state and was WIRED
// instead (`workspace.routes.js`), because "may read this workspace" is a real
// capability that membership alone was silently answering.
//
// TASKS ARE ABSENT, and that is the honest answer rather than an omission.
// Who may touch a task is decided by the PROJECT role ladder
// (shared/middlewares/task.js, ProjectRole in the schema) — a workspace role
// only opens the door via PROJECT_MANAGE_ANY. Rows here for "create task" or
// "move task" would be five switches that gate nothing, which is worse than
// not offering them.
const PERMISSION_CATALOG = [
  {
    area: 'workspace',
    label: 'Workspace',
    actions: [
      { id: PERMISSIONS.WORKSPACE_VIEW, label: 'View workspace' },
      { id: PERMISSIONS.WORKSPACE_UPDATE, label: 'Edit workspace' },
      { id: PERMISSIONS.WORKSPACE_DELETE, label: 'Delete workspace' },
    ],
  },
  {
    area: 'members',
    label: 'Members',
    actions: [
      { id: PERMISSIONS.MEMBER_VIEW, label: 'View members' },
      { id: PERMISSIONS.MEMBER_INVITE, label: 'Invite member' },
      { id: PERMISSIONS.MEMBER_REMOVE, label: 'Remove member' },
      { id: PERMISSIONS.MEMBER_ROLE_UPDATE, label: 'Assign roles' },
    ],
  },
  {
    area: 'projects',
    label: 'Projects',
    actions: [
      { id: PERMISSIONS.PROJECT_VIEW, label: 'View projects' },
      { id: PERMISSIONS.PROJECT_CREATE, label: 'Create project' },
      { id: PERMISSIONS.PROJECT_MANAGE_ANY, label: 'Manage any project' },
    ],
  },
  {
    area: 'roles',
    label: 'Roles',
    actions: [{ id: PERMISSIONS.ROLE_MANAGE, label: 'Define roles' }],
  },
];

// Every permission id, in catalog order. The OWNER's grant, and the ceiling a
// custom role's `permissions` array is filtered against.
const ALL_PERMISSIONS = PERMISSION_CATALOG.flatMap((group) =>
  group.actions.map((action) => action.id)
);

// Project-level roles (ProjectRole in schema.prisma) are deliberately NOT in
// ROLES or ROLE_ORDER above. Those are workspace roles, and `roleAtLeast` walks
// one ladder — a second set of values in it would have it silently answering
// the wrong question. The project ladder is resolved per project, by
// shared/middlewares/project.js.

// Role → permissions granted. Deliberately written out per role rather than
// derived by inheritance: an explicit table is greppable, and it makes the
// OWNER-only rows (delete the workspace, change roles, billing) obvious at a
// glance instead of implied by position in a hierarchy.
//
// This is the DEFAULT grant for each tier — what a membership gets when it
// holds no custom role. A workspace's own roles are rows in `workspace_roles`
// and are resolved by `permissionsFor` below.
const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: [...ALL_PERMISSIONS],
  [ROLES.ADMIN]: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_UPDATE,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_MANAGE_ANY,
    // An admin runs the workspace day to day, and defining a role is part of
    // that. Assigning one (MEMBER_ROLE_UPDATE) stays with the owner: authoring
    // a capability is not the same as handing it to somebody.
    PERMISSIONS.ROLE_MANAGE,
  ],
  // PROJECT_CREATE for a plain MEMBER is a deliberate default, not an
  // oversight: "only admins may start a project" is a workflow decision no
  // module should make unilaterally. Reversing it is deleting one line here,
  // which is the entire reason this table is written out per role.
  [ROLES.MEMBER]: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.PROJECT_CREATE,
  ],
};

// Does `role` hold `permission`? Unknown roles and unknown permissions both
// return false rather than throwing — an authorization check must fail
// closed, and the caller turns that into a 403.
//
// Takes a TIER, not a membership. `permissionsFor` is what callers holding a
// membership should reach for; this remains for the tier-only decisions and
// for the default table's own tests.
const hasPermission = (role, permission) => {
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  return granted.includes(permission);
};

/**
 * The permissions a membership actually holds.
 *
 * A membership with a custom role is granted THAT ROLE'S set, not its tier's —
 * the whole point of defining a role is to say something the three tiers do
 * not. Without one it falls back to the tier's default grant, which is every
 * membership that existed before this feature.
 *
 * **The OWNER tier is never narrowed.** A custom role assigned to the owner
 * cannot take away `workspace.delete` and lock the last person with authority
 * out of their own workspace — the one recovery from which is direct database
 * access. Ownership is an identity; the grid describes capabilities.
 *
 * Unknown ids in a stored array are dropped rather than trusted: a permission
 * the code stopped checking simply stops meaning anything, and one it never
 * had cannot be smuggled in by writing it to the row.
 */
const permissionsFor = (membership) => {
  if (!membership) return [];
  if (membership.role === ROLES.OWNER) return [...ALL_PERMISSIONS];

  const custom = membership.customRole?.permissions;
  if (!Array.isArray(custom)) return ROLE_PERMISSIONS[membership.role] ?? [];

  return ALL_PERMISSIONS.filter((id) => custom.includes(id));
};

/** Does this membership hold `permission`? The check every guard should make. */
const membershipCan = (membership, permission) =>
  permissionsFor(membership).includes(permission);

// True when `role` is at least as privileged as `minimum` on ROLE_ORDER.
const roleAtLeast = (role, minimum) => {
  const roleIndex = ROLE_ORDER.indexOf(role);
  const minimumIndex = ROLE_ORDER.indexOf(minimum);
  if (roleIndex === -1 || minimumIndex === -1) return false;
  return roleIndex >= minimumIndex;
};

export {
  ROLES,
  ROLE_ORDER,
  PERMISSIONS,
  PERMISSION_CATALOG,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  permissionsFor,
  membershipCan,
  roleAtLeast,
};
export default ROLES;
