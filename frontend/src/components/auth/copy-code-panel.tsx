"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";

/*
 * The page behind the code emails' "Copy code" button.
 *
 * WHY A PAGE AT ALL. No mail client runs JavaScript, so the email itself
 * cannot copy anything; it links here with the code in the URL FRAGMENT
 * (`/copy-code#284579`). A fragment is never sent to a server — not to Next,
 * not to a proxy, not in a `Referer` — so the code only ever exists in this
 * tab. See `codeBlock` in backend/src/shared/utils/emailTemplates.js.
 *
 * The copy is attempted once on arrival. Chrome allows that for a focused
 * page; Safari and Firefox require a click, so the Copy button is always
 * there and is the fallback rather than an error. The hash is read through
 * `useSyncExternalStore` (server snapshot "") instead of an effect, which is
 * what keeps the server render and hydration in agreement.
 *
 * Only a six-digit code is accepted: anything else in the fragment is not a
 * code we sent, and is not echoed back onto the page.
 */
const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

type Status = "idle" | "copied" | "failed";

export function CopyCodePanel() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const code = /^#\d{6}$/.test(hash) ? hash.slice(1) : null;
  const [status, setStatus] = useState<Status>("idle");

  const copy = (value: string) =>
    navigator.clipboard
      .writeText(value)
      .then(() => setStatus("copied"))
      .catch(() => setStatus("failed"));

  /* One automatic attempt; a refusal just leaves the button to do it. */
  useEffect(() => {
    if (!code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => setStatus("copied"))
      .catch(() => undefined);
  }, [code]);

  if (!code) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-text">No code in this link</h1>
        <p className="mt-2 text-sm text-text-muted">Open the &ldquo;Copy code&rdquo; button from your email again.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-lg font-semibold text-text">Your Tizello code</h1>

      <p className="mt-6 rounded-lg border border-border bg-panel px-4 py-5 font-mono text-4xl font-bold tracking-[0.3em] text-text select-all">
        {code}
      </p>

      <Button className="mt-6 w-full" onClick={() => copy(code)}>
        {status === "copied" ? (
          <>
            <CheckIcon className="size-4" />
            Copied
          </>
        ) : (
          "Copy code"
        )}
      </Button>

      <p role="status" className="mt-3 text-xs text-text-subtle">
        {status === "copied" && "It's on your clipboard. Go back to Tizello and paste it."}
        {status === "failed" && "Your browser blocked copying. Select the code and copy it yourself."}
        {status === "idle" && "Codes expire a few minutes after they are sent."}
      </p>
    </div>
  );
}
