"use client";

import { use, useState, useTransition } from "react";
import { toast } from "sonner";
import { TaskCommentItem } from "@/components/tasks/task-comment-item";
import type { TaskScope } from "@/components/tasks/task-draft";
import {
  addTaskCommentAction,
  deleteTaskCommentAction,
  type listTaskCommentsAction,
} from "@/lib/actions/task-actions";
import { updateTaskCommentAction } from "@/lib/actions/task-bulk-actions";
import { taskErrorCopy, type Task, type TaskComment } from "@/types/task";

/**
 * The comment thread under a task.
 *
 * The first read is `use()` of a promise the backlog started in the CLICK that
 * opened this task (`task-backlog-panel.tsx`), wrapped in `<Suspense>` by the
 * form. That is the whole reason there is no effect here: fetching in an
 * effect and calling `setState` would trip `react-hooks/set-state-in-effect`,
 * and fetching every thread with the page would be one request per task nobody
 * opened.
 *
 * Posting, editing and deleting write immediately and update the local list
 * once the API has answered — reconciliation, not optimism.
 *
 * Cmd/Ctrl+Enter posts. A plain Enter is a new line: comments are paragraphs.
 */
export function TaskComments({
  task,
  scope,
  promise,
}: {
  task: Task;
  scope: TaskScope;
  promise: ReturnType<typeof listTaskCommentsAction>;
}) {
  const loaded = use(promise);
  const [comments, setComments] = useState<TaskComment[]>(loaded.comments);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function post() {
    if (!body.trim()) return;

    startTransition(async () => {
      const result = await addTaskCommentAction(scope.workspaceId, scope.projectId, task.id, body);
      if (!result.comment) {
        toast.error(taskErrorCopy(result.code ?? "SERVER_ERROR"));
        return;
      }
      const created = result.comment;
      setComments((current) => [...current, created]);
      setBody("");
    });
  }

  /* Awaited by the item rather than run in this transition, so the editor can
     stay open with the text intact when the save fails. */
  async function edit(comment: TaskComment, text: string): Promise<boolean> {
    const result = await updateTaskCommentAction(task.id, comment.id, text);
    if (!result.comment) {
      toast.error(taskErrorCopy(result.code ?? "SERVER_ERROR"));
      return false;
    }
    const updated = result.comment;
    setComments((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    return true;
  }

  function remove(comment: TaskComment) {
    startTransition(async () => {
      const result = await deleteTaskCommentAction(scope.workspaceId, scope.projectId, task.id, comment.id);
      if (result.code) {
        toast.error(taskErrorCopy(result.code));
        return;
      }
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
    });
  }

  return (
    <section className="mt-6 border-t border-border pt-4" aria-label="Comments">
      <h3 className="px-0.5 text-xs font-medium text-text-subtle">Comments</h3>

      {loaded.code && (
        <p className="mt-2 text-2xs text-danger">The comments didn&rsquo;t load. Reopen the task to try again.</p>
      )}

      {comments.length > 0 && (
        <ul className="mt-3 space-y-4">
          {comments.map((comment) => (
            <TaskCommentItem
              key={comment.id}
              comment={comment}
              /* The author may always delete their own; a project writer may
                 moderate anyone's — the API enforces the same two cases. */
              canEdit={comment.authorId === scope.currentUserId && scope.canContribute}
              canDelete={comment.authorId === scope.currentUserId || scope.canManageProperties}
              disabled={isPending}
              onSave={(text) => edit(comment, text)}
              onDelete={() => remove(comment)}
            />
          ))}
        </ul>
      )}

      {scope.canContribute && (
        <div className="mt-3">
          <textarea
            aria-label="Add a comment"
            placeholder="Add a comment…"
            rows={2}
            maxLength={5000}
            value={body}
            disabled={isPending}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                post();
              }
            }}
            className="w-full resize-y rounded-sm border border-border bg-surface px-2.5 py-2 text-sm text-text transition-colors duration-100 ease-standard placeholder:text-text-subtle"
          />
          {body.trim() && (
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <span className="text-2xs text-text-subtle">Ctrl + Enter to post</span>
              <button
                type="button"
                disabled={isPending}
                onClick={post}
                className="rounded-sm bg-brand-500 px-3 py-1.5 text-xs font-semibold text-on-brand transition-colors duration-100 ease-standard hover:bg-brand-400 disabled:opacity-60"
              >
                {isPending ? "Posting…" : "Comment"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
