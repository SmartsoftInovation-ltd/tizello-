import type { ChatMessage } from "@/types/chat";

/*
 * The arithmetic behind a WhatsApp-shaped thread: where a day starts and where
 * a run of messages from one person begins and ends.
 *
 * Pure, and out of the components, because every rule here is a judgement about
 * what the reader sees and none of it needs React to be checked. The layout
 * reads these flags; it does not re-derive them.
 */

/** Messages from the same person inside this window read as one turn. */
const SAME_TURN_MS = 5 * 60 * 1000;

export type ChatRow = {
  message: ChatMessage;
  /** The day heading to draw above this message, or null to draw none. */
  dayLabel: string | null;
  /** First of a run: draws the sender's name and the bubble's tail. */
  startsTurn: boolean;
  /** Last of a run: takes the timestamp and the extra gap beneath. */
  endsTurn: boolean;
};

const dayKey = (iso: string) => iso.slice(0, 10);

/**
 * "Today", "Yesterday", or a written date.
 *
 * Words for the two days people actually mean, because "23 September" for
 * something said an hour ago makes a reader do arithmetic to place it.
 */
export function dayLabel(iso: string, now = new Date()): string {
  const key = dayKey(iso);
  const today = dayKey(now.toISOString());

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (key === today) return "Today";
  if (key === dayKey(yesterday.toISOString())) return "Yesterday";

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year:
      new Date(iso).getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/**
 * Annotates a thread with day breaks and turn boundaries.
 *
 * A TURN BREAKS ON THREE THINGS: a different sender, a new day, and five
 * minutes of silence. The last one is what stops a conversation resumed after
 * lunch from being glued to the one before it, which would put a single name
 * over two unrelated exchanges.
 *
 * A deleted message ends a turn regardless — a tombstone is its own event, and
 * merging it into a run makes it look like part of what is still there.
 */
export function groupMessages(messages: ChatMessage[], now = new Date()): ChatRow[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];

    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);

    /* BOTH SIDES ARE OPTIONAL. The first message has no predecessor and the
       last has no successor, and reading `.sender` off either absence throws
       during render — which is every thread, at its newest message. */
    const continues = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
      Boolean(
        a &&
          b &&
          a.sender?.id === b.sender?.id &&
          !a.deleted &&
          !b.deleted &&
          dayKey(a.createdAt) === dayKey(b.createdAt) &&
          Math.abs(
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ) < SAME_TURN_MS,
      );

    return {
      message,
      dayLabel: newDay ? dayLabel(message.createdAt, now) : null,
      startsTurn: newDay || !continues(previous, message),
      endsTurn: !continues(message, next),
    };
  });
}

/** `14:05` — the only clock a bubble shows; the day is the divider's job. */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
