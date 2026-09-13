"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format-date";
import { initials } from "@/lib/initials";
import type { TaskComment } from "@/types/task";

/**
 * One comment: who, when, and what they said.
 *
 * `whitespace-pre-wrap` keeps the line breaks someone typed — a comment is a
 * paragraph, and collapsing it to one line changes what it says. A comment
 * whose author's account is gone still renders, as "Former member": the words
 * outlive the person, which is why the API sets `authorId` null rather than
 * deleting the row.
 */
export function TaskCommentItem({
  comment,
  canDelete,
  disabled,
  onDelete,
}: {
  comment: TaskComment;
  canDelete: boolean;
  disabled: boolean;
  onDelete: () => void;
}) {
  const author = comment.author
    ? (comment.author.name ?? comment.author.email.split("@")[0])
    : "Former member";

  return (
    <li className="group flex items-start gap-2.5">
      <Avatar className="mt-0.5 size-6 border border-border text-text-muted">
        <AvatarFallback className="text-2xs">
          <span aria-hidden="true">{initials(author)}</span>
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-xs font-semibold text-text">{author}</span>
          <time dateTime={comment.createdAt} className="shrink-0 text-2xs text-text-subtle">
            {formatDate(comment.createdAt)}
          </time>
        </p>
        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-text">{comment.body}</p>
      </div>

      {canDelete && (
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          aria-label={`Delete comment by ${author}`}
          className="grid size-6 shrink-0 place-items-center rounded-sm text-text-subtle opacity-0 transition-opacity duration-100 ease-standard group-hover:opacity-100 hover:bg-surface-hover hover:text-danger focus-visible:opacity-100"
        >
          <TrashIcon className="size-3.5" />
        </button>
      )}
    </li>
  );
}
