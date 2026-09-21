-- In-app notifications: one row per recipient.
--
-- Fan-out on write rather than a shared event with read receipts — the query
-- this table exists to serve is "my unread count", on every page load, for
-- every user, and that is an index scan here versus a join and a NOT EXISTS
-- there.
--
-- `taskId` cascades: a notification whose task has been deleted is a dead link
-- in a list whose every row is a link. `actorId` does not — the notification
-- outlives the person who caused it, because it still explains why the reader
-- has the task.

CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actorId" TEXT,
    "taskId" TEXT,
    "projectName" TEXT,
    "sprintName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- One index per access path, not one wide one: the badge never reads
-- createdAt, and the list never filters on readAt.
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
