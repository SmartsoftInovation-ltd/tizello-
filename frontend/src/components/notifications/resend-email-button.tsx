"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resendAssignmentEmailAction } from "@/lib/actions/notification-actions";

/*
 * "Resend email" on an assignment-email failure: queues the email again for
 * the one person the notification is about. A sibling of the row's own button,
 * never inside it — a button in a button is invalid and swallows the click.
 *
 * Once queued it says "Queued" and stays disabled: the worker retries on its
 * own, and a second click would only queue a duplicate.
 */
const COPY: Record<string, string> = {
  CONFLICT: "They're no longer assigned to that task.",
  FORBIDDEN: "You can't work on that project any more.",
  NOT_FOUND: "That task or person no longer exists.",
};

export function ResendEmailButton({ notificationId, who }: { notificationId: string; who: string }) {
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);

  function resend() {
    startTransition(async () => {
      const result = await resendAssignmentEmailAction(notificationId);
      if (!result.ok) {
        toast.error(COPY[result.code] ?? "Couldn't queue the email. Try again.");
        return;
      }
      setQueued(true);
      toast.success(`Email to ${who} queued`);
    });
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={pending || queued}
      className="mt-1.5 inline-flex items-center rounded-sm border border-border bg-surface px-2 py-0.5 text-2xs font-semibold text-text-brand transition-colors duration-100 ease-standard hover:bg-surface-hover disabled:cursor-default disabled:text-text-subtle"
    >
      {queued ? "Queued" : pending ? "Sending…" : "Resend email"}
    </button>
  );
}
