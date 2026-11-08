import { MessagesMenu } from "@/components/chat/messages-menu";
import { getChatInbox } from "@/lib/chat";

/** The server half of the messages icon: fetch who has written, hand it down. */
export async function MessagesButton() {
  const senders = await getChatInbox();
  return <MessagesMenu senders={senders} />;
}
