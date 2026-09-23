import { apiCallWithRefresh } from "@/lib/api-client";
import type { ChatChannel, ChatPage, ChatTarget } from "@/types/chat";

/*
 * The chat API — `backend/docs/api/chat.md`.
 *
 * **Reads only.** Sending, editing and deleting a message are socket events,
 * not requests: the server writes the row and then broadcasts it, and a REST
 * twin would be a second write path with its own broadcast to forget. The one
 * write here is the read watermark, which nobody watches live.
 *
 * TWO CHANNEL KINDS, ONE SET OF CALLS. A `ChatTarget` is `{ workspaceId }` or
 * `{ projectId }`, and it becomes the path prefix — `/workspaces/:id/messages`
 * or `/projects/:id/messages`. The server owns the difference between them
 * (every member of a workspace; a project's contributors), so nothing here
 * branches on which kind it holds beyond building the URL.
 *
 * The caller's membership is resolved from the session — a non-member gets the
 * same `404` as a workspace or project that does not exist, so there is no
 * code here that means "forbidden".
 */

export type ChatResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string };

const base = (target: ChatTarget) =>
  target.workspaceId
    ? `/workspaces/${encodeURIComponent(target.workspaceId)}/messages`
    : `/projects/${encodeURIComponent(target.projectId!)}/messages`;

/**
 * `GET /projects/:id/messages`. Newest first.
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
  target: ChatTarget,
  { limit = 30, cursor }: { limit?: number; cursor?: string | null } = {},
): Promise<ChatPage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);

  const result = await apiCallWithRefresh<ChatPage>(
    `${base(target)}?${query.toString()}`,
  );

  return result.ok ? result.data : { messages: [], nextCursor: null };
}

/**
 * `GET .../messages/channel` — the channel's id, kind and name.
 *
 * The id is what a socket joins a room by, and a client cannot know one it has
 * never been told. `null` when the caller may not use the channel, which is
 * the same answer as "no such workspace" by design.
 */
export async function getChannel(target: ChatTarget): Promise<ChatChannel | null> {
  const result = await apiCallWithRefresh<{ channel: ChatChannel }>(
    `${base(target)}/channel`,
  );

  return result.ok ? result.data.channel : null;
}

/**
 * `GET /projects/:id/messages/unread-count`.
 *
 * Excludes the caller's own messages and tombstones, server-side. Zero on
 * failure, for the same reason the page above is empty on failure: an unread
 * dot is not worth an error boundary.
 */
export async function getUnreadCount(target: ChatTarget): Promise<number> {
  const result = await apiCallWithRefresh<{ count: number }>(
    `${base(target)}/unread-count`,
  );

  return result.ok ? result.data.count : 0;
}

/**
 * `POST /projects/:id/messages/read`. Idempotent, and the watermark never
 * moves backwards — a late call from a tab that was behind cannot un-read what
 * another tab already read, so this is safe to fire whenever the panel is open.
 */
export async function markChannelRead(
  target: ChatTarget,
): Promise<ChatResult<{ lastReadAt: string }>> {
  const result = await apiCallWithRefresh<{ lastReadAt: string }>(
    `${base(target)}/read`,
    { method: "POST", body: JSON.stringify({}) },
  );

  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, code: result.code };
}
