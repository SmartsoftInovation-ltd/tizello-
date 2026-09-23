"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getChannel, getMessages, getUnreadCount, markChannelRead } from "@/lib/chat";
import type { ChatChannel, ChatPage, ChatSender, ChatTarget } from "@/types/chat";

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
  target: ChatTarget,
  cursor?: string | null,
): Promise<ChatPage> {
  return getMessages(target, { cursor });
}

/** The channel behind a target, so the client can join its socket room. */
export async function loadChannelAction(
  target: ChatTarget,
): Promise<ChatChannel | null> {
  return getChannel(target);
}

/**
 * The unread count for a channel, for a launcher that has no server parent to
 * fetch it — the sidebar's row, which is a client leaf inside a client nav.
 *
 * Zero when the caller may not use the channel, which is the same answer as an
 * empty one: a sidebar badge is not the place to report a permission.
 */
export async function loadUnreadCountAction(target: ChatTarget): Promise<number> {
  return getUnreadCount(target);
}

/**
 * Who is asking, in the shape the message list needs to mark a message as the
 * reader's own.
 *
 * It exists for the same reason as the action above: the sidebar row cannot be
 * handed the session as a prop, because the nav it sits in is a client tree
 * fed by plain serialisable data. Returning the session rather than trusting a
 * client-supplied id is the point — an id a client could choose would decide
 * which messages it may edit.
 */
export async function loadChatViewerAction(): Promise<ChatSender | null> {
  const user = await getSession();

  return user
    ? { id: user.id, name: user.name, email: user.email, avatarUrl: null }
    : null;
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
  target: ChatTarget,
): Promise<{ ok: boolean }> {
  const result = await markChannelRead(target);
  if (!result.ok) return { ok: false };

  revalidatePath("/", "layout");
  return { ok: true };
}
