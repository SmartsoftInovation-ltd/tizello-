-- Assignment emails that fail every retry become a notification to the
-- assigner and the workspace's owners/admins, who can resend to that one
-- person. `subjectUserId` names that person: neither the reader nor the actor.
-- Additive only — a new enum value and a nullable column.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_EMAIL_FAILED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "subjectUserId" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
