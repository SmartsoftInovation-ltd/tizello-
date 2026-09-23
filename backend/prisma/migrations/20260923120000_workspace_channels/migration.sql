-- Workspace-wide chat: the conversation target becomes a CHANNEL.
--
-- Chat shipped with `projectId` on the message, and the contract argued there
-- was no channel table because the project WAS the channel. A workspace-wide
-- channel ends that: with two kinds of target, "which conversation is this" is
-- a real question, and two nullable columns on `messages` would put the XOR on
-- the table read on every page rather than on the one read once per channel.
--
-- `messages.channelId` and `message_reads.channelId` are added NOT NULL with no
-- default and no backfill, which is only safe because both tables are EMPTY —
-- verified before writing this (0 messages, 0 watermarks; the feature had a UI
-- for one day and its test fixtures were deleted). On a populated database this
-- migration would need a channel row per distinct projectId first.
--
-- The CHECK is the half Prisma cannot express: exactly one target per channel.
-- Without it a row with both columns set would be readable as either kind, and
-- the access check would depend on which branch the code happened to take.

-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('WORKSPACE', 'PROJECT');

-- DropForeignKey
ALTER TABLE "message_reads" DROP CONSTRAINT "message_reads_projectId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_projectId_fkey";

-- DropIndex
DROP INDEX "message_reads_userId_projectId_key";

-- DropIndex
DROP INDEX "messages_projectId_createdAt_idx";

-- AlterTable
ALTER TABLE "message_reads" DROP COLUMN "projectId",
ADD COLUMN     "channelId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "projectId",
ADD COLUMN     "channelId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "kind" "ChannelKind" NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_workspaceId_key" ON "channels"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "channels_projectId_key" ON "channels"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_userId_channelId_key" ON "message_reads"("userId", "channelId");

-- CreateIndex
CREATE INDEX "messages_channelId_createdAt_idx" ON "messages"("channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one target. Prisma has no CHECK support, so this lives only here —
-- see prisma/schema.prisma's Channel comment, which points back at it.
ALTER TABLE "channels" ADD CONSTRAINT "channels_one_target"
  CHECK (num_nonnulls("workspaceId", "projectId") = 1);
