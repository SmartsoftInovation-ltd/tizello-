"use server";

import { revalidatePath } from "next/cache";
import { getMessages, markChannelRead } from "@/lib/chat";
import type { ChatPage } from "@/types/chat";

/*
 * Chat's server boundary. Thin by rule: call a plain function from
 * `lib/chat.ts`, revalidate where something on screen changed, return
 * something serialisable.
 *
 * **WHY HISTORY IS AN ACTION AND NOT A FETCH FROM THE CLIENT.** The panel is a
 * client leaf, and the session cookie is `httpOnly` and lives on THIS origin —
 * the browser can talk to the API directly only over the socket, which carries
 * the cookie itself. A client `fetch` to the API would have no credential to
 * send. Routing the read through here keeps the token where it belongs and
 * keeps the API base URL out of the bundle.
 *
 * Sending, editing and deleting are deliberately absent: those are socket
 * events, so that no message can exist without having been broadcast.
 */

/** One page of a channel, for the panel's first draw and for scrolling up. */
export async function loadMessagesAction(
  workspaceId: string,
  cursor?: string | null,
): Promise<ChatPage> {
  return getMessages(workspaceId, { cursor });
}

/**
 * Moves the caller's read watermark to now.
 *
 * `revalidatePath("/", "layout")` rather than this route: an unread badge for
 * a channel can be drawn anywhere under the shell, so revalidating the layout
 * is what makes it correct wherever the reader is standing — the same argument
 * `notification-actions.ts` makes for the bell.
 */
export async function markChannelReadAction(
  workspaceId: string,
): Promise<{ ok: boolean }> {
  const result = await markChannelRead(workspaceId);
  if (!result.ok) return { ok: false };

  revalidatePath("/", "layout");
  return { ok: true };
}
