-- Workspace-defined roles, and the membership column that points at one.
--
-- `roleId` is nullable and ON DELETE SET NULL: a membership without a custom
-- role falls back to its tier's default grant, which is every membership that
-- existed before this migration, and deleting a role must never delete the
-- people who held it.
--
-- The built-in rows (Owner/Admin/Member per workspace) are NOT backfilled here.
-- They are seeded on first read by role.service.js#listRoles from the same
-- ROLE_PERMISSIONS table the fallback uses, so there is one definition of what
-- Owner means rather than two that can drift.

CREATE TABLE "workspace_roles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRole" "Role" NOT NULL DEFAULT 'MEMBER',
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_roles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspace_roles_workspaceId_idx" ON "workspace_roles"("workspaceId");

-- Two roles with one name in a workspace would make the cards unreadable and
-- the audit trail ambiguous. It is also what settles a race between two
-- requests seeding the built-ins at the same time.
CREATE UNIQUE INDEX "workspace_roles_workspaceId_name_key" ON "workspace_roles"("workspaceId", "name");

ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_roles" ADD CONSTRAINT "workspace_roles_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "memberships" ADD COLUMN "roleId" TEXT;

CREATE INDEX "memberships_roleId_idx" ON "memberships"("roleId");

ALTER TABLE "memberships" ADD CONSTRAINT "memberships_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "workspace_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
