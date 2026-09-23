-- Chat is workspace-wide only: project channels are removed.
--
-- The `channels` table lasted one day. It was added when chat had two
-- audiences, a workspace and a project, because "which conversation is this"
-- was then a real question with two nullable columns fighting to answer it.
-- Project chat was dropped at the product's request, one audience is left, and
-- a table whose every row is `(id, workspaceId)` answers nothing — so the
-- message carries its workspace again and the table goes.
--
-- `workspaceId` is added NOT NULL with no default and no backfill, which is
-- only safe because `messages` and `message_reads` are EMPTY — verified before
-- writing this (0 rows in both; the two `channels` rows were created by opening
-- a screen, not by anybody speaking). On a populated database this needs
-- `UPDATE messages SET "workspaceId" = c."workspaceId" FROM channels c` first,
-- and would have to decide what becomes of project-channel messages, which have
-- no workspace conversation to be merged into.

-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_projectId_fkey";

-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "message_reads" DROP CONSTRAINT "message_reads_channelId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_channelId_fkey";

-- DropIndex
DROP INDEX "message_reads_userId_channelId_key";

-- DropIndex
DROP INDEX "messages_channelId_createdAt_idx";

-- AlterTable
ALTER TABLE "message_reads" DROP COLUMN "channelId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "channelId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "channels";

-- DropEnum
DROP TYPE "ChannelKind";

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_userId_workspaceId_key" ON "message_reads"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "messages_workspaceId_createdAt_idx" ON "messages"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
