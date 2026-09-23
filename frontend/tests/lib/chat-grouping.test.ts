import test from "node:test";
import assert from "node:assert/strict";
import { clockTime, dayLabel, groupMessages } from "../../src/lib/chat-grouping.ts";
import type { ChatMessage } from "../../src/types/chat.ts";

/*
 * The thread's shape, which is the part of a chat UI that is arithmetic rather
 * than CSS: where a day heading goes, and where a run of messages from one
 * person begins and ends. Getting it wrong is what makes a chat read as a wall
 * of paragraphs, and none of it needs a browser to check.
 */

const NOW = new Date("2026-09-23T12:00:00.000Z");

const message = (over: Partial<ChatMessage> & { id: string }): ChatMessage => ({
  workspaceId: "w1",
  content: "hi",
  deleted: false,
  editedAt: null,
  createdAt: "2026-09-23T10:00:00.000Z",
  sender: { id: "u1", name: "Owner", email: "o@example.com", avatarUrl: null },
  ...over,
});

const other = (over: Partial<ChatMessage> & { id: string }) =>
  message({
    sender: { id: "u2", name: "Collab", email: "c@example.com", avatarUrl: null },
    ...over,
  });

test("dayLabel says Today and Yesterday, and a date beyond that", () => {
  assert.equal(dayLabel("2026-09-23T09:00:00.000Z", NOW), "Today");
  assert.equal(dayLabel("2026-09-22T09:00:00.000Z", NOW), "Yesterday");
  assert.match(dayLabel("2026-09-01T09:00:00.000Z", NOW), /September/);
});

test("a date in another year carries the year", () => {
  assert.match(dayLabel("2025-09-01T09:00:00.000Z", NOW), /2025/);
});

test("the first message of a day carries the heading, the rest do not", () => {
  const rows = groupMessages(
    [
      message({ id: "a", createdAt: "2026-09-22T10:00:00.000Z" }),
      message({ id: "b", createdAt: "2026-09-23T10:00:00.000Z" }),
      message({ id: "c", createdAt: "2026-09-23T10:01:00.000Z" }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.dayLabel),
    ["Yesterday", "Today", null],
  );
});

test("messages from one person inside five minutes are one turn", () => {
  const rows = groupMessages(
    [
      message({ id: "a", createdAt: "2026-09-23T10:00:00.000Z" }),
      message({ id: "b", createdAt: "2026-09-23T10:01:00.000Z" }),
      message({ id: "c", createdAt: "2026-09-23T10:02:00.000Z" }),
    ],
    NOW,
  );

  // Only the first draws a name and a tail; only the last draws a clock.
  assert.deepEqual(
    rows.map((row) => row.startsTurn),
    [true, false, false],
  );
  assert.deepEqual(
    rows.map((row) => row.endsTurn),
    [false, false, true],
  );
});

test("a different sender starts a new turn", () => {
  const rows = groupMessages(
    [
      message({ id: "a", createdAt: "2026-09-23T10:00:00.000Z" }),
      other({ id: "b", createdAt: "2026-09-23T10:00:30.000Z" }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.startsTurn),
    [true, true],
  );
  assert.deepEqual(
    rows.map((row) => row.endsTurn),
    [true, true],
  );
});

test("a five-minute silence breaks the turn", () => {
  const rows = groupMessages(
    [
      message({ id: "a", createdAt: "2026-09-23T10:00:00.000Z" }),
      message({ id: "b", createdAt: "2026-09-23T10:06:00.000Z" }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.startsTurn),
    [true, true],
  );
});

test("a tombstone is its own turn, and does not absorb its neighbours", () => {
  const rows = groupMessages(
    [
      message({ id: "a", createdAt: "2026-09-23T10:00:00.000Z" }),
      message({
        id: "b",
        createdAt: "2026-09-23T10:00:30.000Z",
        content: null,
        deleted: true,
      }),
      message({ id: "c", createdAt: "2026-09-23T10:01:00.000Z" }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.startsTurn),
    [true, true, true],
  );
  assert.deepEqual(
    rows.map((row) => row.endsTurn),
    [true, true, true],
  );
});

test("a departed sender groups with itself, not with everyone else's nulls", () => {
  const gone = (id: string, createdAt: string) => message({ id, createdAt, sender: null });

  const rows = groupMessages(
    [gone("a", "2026-09-23T10:00:00.000Z"), gone("b", "2026-09-23T10:00:30.000Z")],
    NOW,
  );

  /* Both senders are null, so they read as one person — which is what the UI
     shows too ("Deleted user"). Recorded because it is a consequence of
     comparing `sender?.id`, not an accident nobody noticed. */
  assert.deepEqual(
    rows.map((row) => row.startsTurn),
    [true, false],
  );
});

test("clockTime renders hours and minutes only", () => {
  assert.match(clockTime("2026-09-23T10:05:00.000Z"), /^\d{1,2}[:.]\d{2}/);
});
