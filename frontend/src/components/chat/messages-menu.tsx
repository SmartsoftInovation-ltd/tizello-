"use client";

import Link from "next/link";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatIcon } from "@/components/ui/nav-icons";
import { formatDate } from "@/lib/format-date";
import { plural } from "@/lib/plural";
import type { ChatUnreadSender } from "@/types/chat";

/*
 * The messages icon in the top strip: a speech bubble with the number of
 * unread messages, and a list of WHO wrote — one row per person per
 * workspace, newest first, with their latest line. A row opens that
 * workspace's chat, where reading it clears the count.
 *
 * Live without a socket of its own: the bell's `useNotificationSocket` already
 * refreshes the shell on `chat:unread`, which re-renders this with new props.
 * Rows are links (`<Link>`), not menu actions — each is a place to go.
 */
const TRIGGER =
  "relative inline-flex size-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-100 ease-standard hover:bg-surface-hover hover:text-text";
const BADGE =
  "absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-2xs font-semibold tabular-nums text-on-brand";

export function MessagesMenu({ senders }: { senders: ChatUnreadSender[] }) {
  const total = senders.reduce((sum, row) => sum + row.count, 0);

  return (
    <DropdownMenu className="relative">
      <DropdownMenuTrigger
        className={TRIGGER}
        aria-label={total > 0 ? `Messages, ${plural(total, "unread message", "unread messages")}` : "Messages"}
      >
        <ChatIcon className="size-4" />
        {total > 0 && (
          <span aria-hidden="true" className={BADGE}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <p className="border-b border-border px-3 py-2 text-xs font-semibold text-text">
          Messages
          {total > 0 && (
            <span className="ml-1 font-normal text-text-subtle tabular-nums">
              {plural(senders.length, "person", "people")} · {total} unread
            </span>
          )}
        </p>

        {senders.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-text-subtle">No new messages.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {senders.map((row) => {
              const name = row.sender?.name?.trim() || row.sender?.email || "Someone";
              return (
                <li key={`${row.workspaceId}:${row.sender?.id ?? "gone"}`} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/workspaces/${encodeURIComponent(row.workspaceId)}/chat`}
                    className="flex items-start gap-2.5 px-3 py-2.5 transition-colors duration-100 ease-standard hover:bg-surface-hover"
                  >
                    <ChatAvatar
                      sender={row.sender ? { ...row.sender, nickname: null } : null}
                      className="size-8 shrink-0"
                    />
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
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
