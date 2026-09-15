"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format-date";
import { initials } from "@/lib/initials";
import type { TaskComment } from "@/types/task";

/**
 * One comment: who, when, and what they said — and, for its author, a way to
 * rewrite it.
 *
 * `whitespace-pre-wrap` keeps the line breaks someone typed — a comment is a
 * paragraph, and collapsing it to one line changes what it says. A comment
 * whose author's account is gone still renders, as "Former member": the words
 * outlive the person, which is why the API sets `authorId` null rather than
 * deleting the row.
 *
 * AN EDIT IS ALWAYS VISIBLE. The API stamps `editedAt` and this draws
 * "edited" beside the date, so a thread never silently says something other
 * than what people replied to. Only the author gets Edit; a moderator gets
 * Delete — the API enforces the same split.
 *
 * No `<form>` for the editor: this renders inside the drawer's form, and a
 * nested form is invalid HTML. Ctrl/Cmd+Enter saves, Escape cancels.
 */
const ICON_BUTTON =
  "grid size-6 shrink-0 place-items-center rounded-sm text-text-subtle opacity-0 transition-opacity duration-100 ease-standard group-hover:opacity-100 hover:bg-surface-hover focus-visible:opacity-100";

export function TaskCommentItem({
  comment,
  canEdit,
  canDelete,
  disabled,
  onSave,
  onDelete,
}: {
  comment: TaskComment;
  canEdit: boolean;
  canDelete: boolean;
  disabled: boolean;
  /** Resolves `true` once saved, so the editor closes only on success. */
  onSave: (body: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const author = comment.author
    ? (comment.author.name ?? comment.author.email.split("@")[0])
    : "Former member";

  async function save() {
    if (draft === null || !draft.trim()) return;
    if (draft.trim() === comment.body) return setDraft(null);
    if (await onSave(draft)) setDraft(null);
  }

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
          {comment.editedAt && (
            <span title={`Edited ${formatDate(comment.editedAt)}`} className="text-2xs text-text-subtle">
              (edited)
            </span>
          )}
        </p>

        {draft === null ? (
          <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-text">{comment.body}</p>
        ) : (
          <div className="mt-1">
            <textarea
              autoFocus
              aria-label="Edit comment"
              rows={2}
              maxLength={5000}
              value={draft}
              disabled={disabled}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void save();
                } else if (event.key === "Escape") {
                  /* Esc would otherwise close the whole drawer. */
                  event.preventDefault();
                  setDraft(null);
                }
              }}
              className="w-full resize-y rounded-sm border border-border bg-surface px-2.5 py-2 text-sm text-text"
            />
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-hover hover:text-text">
                Cancel
              </button>
              <button
                type="button"
                disabled={disabled || !draft.trim()}
                onClick={() => void save()}
                className="rounded-sm bg-brand-500 px-3 py-1 text-xs font-semibold text-on-brand hover:bg-brand-400 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {canEdit && draft === null && (
        <button type="button" disabled={disabled} onClick={() => setDraft(comment.body)} aria-label={`Edit your comment`} className={`${ICON_BUTTON} hover:text-text`}>
          <PencilIcon className="size-3.5" />
        </button>
      )}
      {canDelete && draft === null && (
        <button type="button" disabled={disabled} onClick={onDelete} aria-label={`Delete comment by ${author}`} className={`${ICON_BUTTON} hover:text-danger`}>
          <TrashIcon className="size-3.5" />
        </button>
      )}
    </li>
  );
}
