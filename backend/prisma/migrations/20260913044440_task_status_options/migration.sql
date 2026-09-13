-- Editable, per-project task statuses. docs/api/task.md §Statuses.
--
-- HAND-EDITED from Prisma's generated diff, which dropped `tasks.status` and
-- added a NOT NULL `statusId` with no value — lossy, and impossible on a table
-- with rows. This version keeps every task's state:
--
--   1. create the group enum and the options table;
--   2. seed Not Started / In Progress / Done for EVERY existing project;
--   3. add `statusId` nullable, map each task's old enum value to its project's
--      matching option, then make it NOT NULL and add the RESTRICT foreign key;
--   4. only then drop the old column and enum.
--
-- The end state is identical to the generated SQL, so the schema has no drift.

-- 1. Enum + table ------------------------------------------------------------
CREATE TYPE "TaskStatusGroup" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETE');

CREATE TABLE "task_status_options" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "group" "TaskStatusGroup" NOT NULL,
    "position" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_status_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_status_options_projectId_idx" ON "task_status_options"("projectId");

CREATE UNIQUE INDEX "task_status_options_projectId_name_key" ON "task_status_options"("projectId", "name");

ALTER TABLE "task_status_options" ADD CONSTRAINT "task_status_options_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Seed the three defaults for every existing project ----------------------
-- Soft-deleted projects included: their tasks still need a status to satisfy
-- the NOT NULL below. Must match DEFAULT_STATUSES in
-- src/shared/constants/taskStatus.js.
INSERT INTO "task_status_options" ("id", "projectId", "name", "color", "group", "position", "isDefault", "updatedAt")
SELECT gen_random_uuid()::text, p."id", d."name", d."color", d."group"::"TaskStatusGroup", 10, d."isDefault", CURRENT_TIMESTAMP
FROM "projects" p
CROSS JOIN (VALUES
    ('Not Started', 'gray',  'TODO',        true),
    ('In Progress', 'blue',  'IN_PROGRESS', false),
    ('Done',        'green', 'COMPLETE',    false)
) AS d("name", "color", "group", "isDefault");

-- 3. Point every task at its project's matching option -----------------------
ALTER TABLE "tasks" ADD COLUMN "statusId" TEXT;

UPDATE "tasks" t
SET "statusId" = o."id"
FROM "task_status_options" o
WHERE o."projectId" = t."projectId"
  AND o."name" = CASE t."status"
      WHEN 'NOT_STARTED' THEN 'Not Started'
      WHEN 'IN_PROGRESS' THEN 'In Progress'
      WHEN 'DONE'        THEN 'Done'
  END;

ALTER TABLE "tasks" ALTER COLUMN "statusId" SET NOT NULL;

CREATE INDEX "tasks_statusId_idx" ON "tasks"("statusId");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "task_status_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Retire the old column and enum ------------------------------------------
ALTER TABLE "tasks" DROP COLUMN "status";

DROP TYPE "TaskStatus";
