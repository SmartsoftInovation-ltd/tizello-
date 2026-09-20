"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { purgeTrashEntryAction, restoreTrashEntryAction } from "@/lib/actions/trash-actions";
import type { TrashEntry } from "@/types/trash";

/**
 * The two things you can do to a trashed row: put it back, or destroy it.
 *
 * RESTORE HAS NO CONFIRM AND PURGE HAS ONE, which is the asymmetry the whole
 * screen turns on. Restoring is reversible — you can delete it again — so a
 * dialog in front of it is a toll on the safe action. Purging is the one
 * button in this app that destroys a row outright, and the dialog names what
 * goes with it, because "and everything in it" is true here in a way it is not
 * for a soft delete.
 *
 * NEITHER IS OPTIMISTIC. The row stays until the server agrees, so a `403`
 * lands while the person who pressed the button is still looking at it. A
 * restore that drew itself as done and then failed would leave someone
 * believing their work is back.
 *
 * `canRestore` only hides the buttons; the endpoint enforces. A client that
 * decided permissions would be a client that can be edited.
 */
export function TrashRowActions({ entry }: { entry: TrashEntry }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const noun = entry.kind === "project" ? "Project" : "Task";

  function run(action: () => Promise<{ ok: boolean; code?: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      setConfirming(false);

      if (result.ok) toast.success(done);
      else toast.error(result.code === "FORBIDDEN" ? `You cannot do that to this ${noun.toLowerCase()}.` : "That didn't work. Try again.");
    });
  }

  if (!entry.canRestore) {
    return (
      <span className="shrink-0 text-2xs text-text-subtle" title="Only someone who could delete it can bring it back">
        No access
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => run(() => restoreTrashEntryAction(entry.kind, entry.id), `${noun} restored`)}
      >
        Restore
      </Button>

      <Button size="sm" variant="dangerSubtle" disabled={isPending} onClick={() => setConfirming(true)}>
        Delete forever
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {entry.name} forever?</DialogTitle>
            <DialogDescription>
              {entry.kind === "project"
                ? "This destroys the project and every task, status and sprint inside it. It cannot be undone — not even from here."
                : "This destroys the task and its comments and activity. It cannot be undone — not even from here."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => run(() => purgeTrashEntryAction(entry.kind, entry.id), `${noun} deleted forever`)}
            >
              {isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
