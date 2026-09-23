import type { ChatPresence } from "@/types/chat";

/**
 * Adds or removes somebody from the "… is typing" list.
 *
 * A TYPING EVENT IS A KEYSTROKE SIGNAL, NOT A PERSON: it carries an id and a
 * name and nothing else, so the entry is padded out to the shape the list
 * holds. Nothing renders a typist\u2019s face, which is why the padding is
 * harmless — and why this is the one place in the chat client that builds a
 * `ChatSender` out of thin air, rather than a dozen call sites each inventing
 * their own half-filled one.
 */
export function withTypist(
  held: ChatPresence[],
  userId: string,
  name: string | null,
  typing: boolean,
): ChatPresence[] {
  const without = held.filter((who) => who.id !== userId);

  return typing
    ? [...without, { id: userId, name, nickname: null, email: "", avatarUrl: null }]
    : without;
}
