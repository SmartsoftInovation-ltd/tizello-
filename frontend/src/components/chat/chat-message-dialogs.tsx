"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONTENT_MAX } from "@/lib/chat-limits";
import type { ChatMessage } from "@/types/chat";

/*
 * Editing and deleting a message, as dialogs.
 *
 * WHY NOT IN THE BUBBLE. Editing used to swap the bubble for a textarea, which
 * reflowed the thread under the reader's cursor and left the message being
 * edited the same size and shape as the ones around it — so it was easy to
 * lose which one was open. A dialog takes focus, says what is being changed
 * and cannot be scrolled away from.
 *
 * ONE PAIR FOR THE WHOLE THREAD, held by `ChatThread`, not one per bubble: a
 * hundred messages would otherwise mean a hundred `<dialog>` elements in the
 * DOM, each with its own state, ninety-nine of them closed.
 *
 * Both are built on `ui/dialog.tsx` — a native `<dialog>` with `showModal()`,
 * so focus trapping, Esc and the top layer come from the platform.
 *
 * EACH ONE CLOSES ON THE CLICK, with no spinner and nothing to wait for. The
 * change is applied to the thread immediately and confirmed behind the reader
 * (`chat-send.ts`), so by the time the dialog is gone the new text or the
 * tombstone is already on screen. Holding the dialog open on a round trip —
 * which this did for a while — put a spinner in front of a result that was
 * about to be instant, and made a fast connection feel slow.
 *
 * A refusal is rare and is corrected rather than pre-empted: the thread puts
 * the old text back and the notice strip says so.
 */

/**
 * The form, mounted per message.
 *
 * SEEDED BY `useState`, NOT BY AN EFFECT. Copying the message into state from
 * a `useEffect` is the `react-hooks/set-state-in-effect` mistake the lint rule
 * exists for: it renders once with stale text before correcting itself. The
 * parent gives this a `key` of the message id instead, so opening a different
 * message mounts a different form and the initial value is simply the initial
 * value.
 */
function EditForm({
  message,
  onCancel,
  onSave,
}: {
  message: ChatMessage;
  onCancel: () => void;
  onSave: (id: string, content: string) => void;
}) {
  const [draft, setDraft] = useState(message.content ?? "");

  const trimmed = draft.trim();
  const unchanged = trimmed === (message.content ?? "");

  const save = () => {
    if (trimmed && !unchanged) onSave(message.id, trimmed);
    onCancel();
  };

  return (
    <>
      <textarea
        value={draft}
        rows={4}
        maxLength={CONTENT_MAX}
        aria-label="Message"
        data-autofocus
        className="mt-4 w-full resize-none rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:border-border-strong"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          /* Enter saves, as it does in the composer — the same key doing the
             same thing in both places is worth more than a newline here. */
          if (event.key !== "Enter" || event.shiftKey) return;
          event.preventDefault();
          save();
        }}
      />

      <DialogFooter className="mt-5">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!trimmed || unchanged} onClick={save}>
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

export function ChatEditDialog({
  message,
  onCancel,
  onSave,
}: {
  /** `null` while closed. */
  message: ChatMessage | null;
  onCancel: () => void;
  onSave: (id: string, content: string) => void;
}) {
  const titleId = useId();

  return (
    <Dialog
      open={message !== null}
      onOpenChange={(open) => !open && onCancel()}
      aria-labelledby={titleId}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>Edit message</DialogTitle>
          <DialogDescription>
            Everyone in the channel sees the change, and the message is marked
            as edited.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <EditForm
            key={message.id}
            message={message}
            onCancel={onCancel}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirm, then delete.
 *
 * No type-to-confirm: a message is one line somebody wrote, not a container of
 * other people's work, and a gate that heavy on something people do several
 * times a day trains them to click through it — the same argument
 * `task-delete-dialog.tsx` makes.
 *
 * The copy says what actually happens: the message is removed for everyone and
 * leaves a "deleted" marker, because the row stays so a reply quoting it does
 * not dangle. Promising it disappears entirely would be untrue.
 */
export function ChatDeleteDialog({
  message,
  onCancel,
  onConfirm,
}: {
  message: ChatMessage | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const titleId = useId();

  const confirm = () => {
    if (message) onConfirm(message.id);
    onCancel();
  };

  return (
    <Dialog
      open={message !== null}
      onOpenChange={(open) => !open && onCancel()}
      aria-labelledby={titleId}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle id={titleId}>Delete this message?</DialogTitle>
          <DialogDescription>
            It goes for everyone in the channel and leaves a &ldquo;message
            deleted&rdquo; marker in its place. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {message?.content && (
          <p className="mt-4 rounded-sm bg-chip px-3 py-2 text-sm break-words whitespace-pre-wrap text-text-muted">
            {message.content}
          </p>
        )}

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm}>
            Delete message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
