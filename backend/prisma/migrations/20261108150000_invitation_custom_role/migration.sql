-- An invitation can name a workspace-defined role, so the invitee joins with
-- it instead of only Admin/Member. Nullable and additive; SetNull keeps a
-- pending invite valid if its role is deleted.

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "roleId" TEXT;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "workspace_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
