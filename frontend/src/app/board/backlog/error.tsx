"use client";

import { Button } from "@/components/ui/button";

/*
 * Segment error boundary. Must be a Client Component — React attaches it on
 * the client to catch render errors and to expose `reset`.
 */
export default function BacklogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid h-full place-items-center px-6">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold text-text">
          The backlog didn&rsquo;t load
        </h1>
        <p className="text-sm text-text-muted">
          Something failed while fetching this project&rsquo;s tasks. Trying
          again usually works.
        </p>
        {error.digest && (
          <p className="font-mono text-2xs text-text-subtle">
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
