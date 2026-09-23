-- Files sent with a chat message.
--
-- One nullable JSONB column rather than a `message_attachments` table: nothing
-- queries inside it, every read wants the whole array alongside its message,
-- and a row per file would add a join to the only query this module runs. The
-- shape — `[{ id, name, storedName, url, size, mime }]` — is what
-- `POST /uploads` answered, and `chat.validator.js` is the only writer.
--
-- Nullable, not `DEFAULT '[]'`: the overwhelming majority of messages are text,
-- and NULL is one byte of null-bitmap where an empty array is a JSONB document
-- per row. The DTO reads NULL as `[]`, so no caller sees the difference.

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachments" JSONB;
