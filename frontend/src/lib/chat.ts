import { apiCallWithRefresh } from "@/lib/api-client";
import type { ChatPage } from "@/types/chat";

/*
 * The chat API — `backend/docs/api/chat.md`.
 *
 * **Reads only.** Sending, editing and deleting a message are socket events,
 * not requests: the server writes the row and then broadcasts it, and a REST
 * twin would be a second write path with its own broadcast to forget. The one
 * write here is the read watermark, which nobody watches live.
 *
 * ONE CHANNEL PER WORKSPACE. Every member of the workspace may read and write
 * it, and membership is resolved from the session — a non-member gets the same
 * `404` as a workspace that does not exist, so there is no code here that
 * means "forbidden".
 */

export type ChatResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string };

const base = (workspaceId: string) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/messages`;

/**
 * `GET /workspaces/:id/messages`. Newest first.
 *
 * Returns an empty page rather than throwing: this runs in a render and in a
 * Server Action behind an open panel, and a channel that cannot load should
 * draw its empty state, not replace the screen with an error page.
 *
 * `cursor` is whatever the previous page's `nextCursor` was, passed back
 * untouched. It is opaque on purpose — it encodes `(createdAt, id)`, and a
 * client that parses one will eventually construct one.
 */
export async function getMessages(
  workspaceId: string,
  { limit = 30, cursor }: { limit?: number; cursor?: string | null } = {},
): Promise<ChatPage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);

  const result = await apiCallWithRefresh<ChatPage>(
    `${base(workspaceId)}?${query.toString()}`,
  );

  return result.ok ? result.data : { messages: [], nextCursor: null };
}

/**
 * `GET /workspaces/:id/messages/unread-count`.
 *
 * Excludes the caller's own messages and tombstones, server-side. Zero on
 * failure, for the same reason the page above is empty on failure: an unread
 * dot is not worth an error boundary.
 */
export async function getUnreadCount(workspaceId: string): Promise<number> {
  const result = await apiCallWithRefresh<{ count: number }>(
    `${base(workspaceId)}/unread-count`,
  );

  return result.ok ? result.data.count : 0;
}

/**
 * `POST /workspaces/:id/messages/read`. Idempotent, and the watermark never
 * moves backwards — a late call from a tab that was behind cannot un-read what
 * another tab already read, so this is safe to fire whenever the panel is open.
 */
export async function markChannelRead(
  workspaceId: string,
): Promise<ChatResult<{ lastReadAt: string }>> {
  const result = await apiCallWithRefresh<{ lastReadAt: string }>(
    `${base(workspaceId)}/read`,
    { method: "POST", body: JSON.stringify({}) },
  );

  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, code: result.code };
}
