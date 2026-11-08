-- A workspace can show an uploaded picture instead of an emoji. Nullable and
-- additive: every existing workspace keeps its icon or initials.

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "imageUrl" TEXT;
