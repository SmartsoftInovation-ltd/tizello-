import Link from "next/link";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { formatDate } from "@/lib/format-date";
import type { ChatUnreadSender } from "@/types/chat";

/*
 * One person's unread messages, as a row in the bell's menu: their avatar and
 * name, the time and text of their latest message, the workspace, and how many
 * are unread. The row opens that workspace's chat, where reading clears it.
 * A link, not a menu action — it is a place to go.
 */
export function ChatUnreadRow({ row }: { row: ChatUnreadSender }) {
  const name = row.sender?.name?.trim() || row.sender?.email || "Someone";

  return (
    <Link
      href={`/workspaces/${encodeURIComponent(row.workspaceId)}/chat`}
      className="flex items-start gap-2.5 px-3 py-2.5 transition-colors duration-100 ease-standard hover:bg-surface-hover"
    >
      <ChatAvatar sender={row.sender ? { ...row.sender, nickname: null } : null} className="size-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text">{name}</span>
          <span className="shrink-0 text-2xs text-text-subtle">{formatDate(row.lastAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-text-muted">{row.preview || "Sent an attachment"}</span>
        <span className="mt-1 flex items-center gap-1.5 text-2xs text-text-subtle">
          <span aria-hidden="true">{row.workspaceIcon ?? "💬"}</span>
          <span className="truncate">{row.workspaceName}</span>
        </span>
      </span>
      <span className="mt-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-2xs font-semibold text-on-brand tabular-nums">
        {row.count}
      </span>
    </Link>
  );
}
