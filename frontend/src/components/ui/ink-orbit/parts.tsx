"use client";

import React from "react";
import { parseTitle } from "@/components/ui/ink-orbit/logic";

/* Small shared pieces of `InkOrbitFeatures`: the in-view hook, the corner
   brackets, the title with muted runs, the brand mark and the tool glyphs. */

/** True once the element has been on screen. */
export function useInView(threshold = 0.2) {
  const ref = React.useRef(null as HTMLElement | null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    /* Every browser this app supports has IntersectionObserver, so there is
       no fallback branch (a synchronous setState here re-renders in a loop
       under React's effect rules). */
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
}

export function Brackets() {
  return (
    <>
      <span className="ib-c ib-c-tl" aria-hidden="true" />
      <span className="ib-c ib-c-tr" aria-hidden="true" />
      <span className="ib-c ib-c-bl" aria-hidden="true" />
      <span className="ib-c ib-c-br" aria-hidden="true" />
    </>
  );
}

export function Title({ text, className = "ib-h2" }: { text: string; className?: string }) {
  return (
    <h2 className={className}>
      {parseTitle(text).map((line, i) => (
        <span key={i}>
          {line.map((run, j) => (
            <React.Fragment key={j}>
              {run.muted ? (
                <span className="ib-muted" style={{ display: "inline" }}>
                  {run.text}
                </span>
              ) : (
                run.text
              )}
            </React.Fragment>
          ))}
        </span>
      ))}
    </h2>
  );
}

/** The brand glyph — a bold "T" for Tizello. */
export function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3h18v4.5h-6.75V21h-4.5V7.5H3z" fill="currentColor" />
    </svg>
  );
}

export function ToolGlyph({ index }: { index: number }) {
  const k = index % 4;
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {k === 0 && (
        <>
          <rect x="-6" y="-6" width="12" height="12" rx="1.5" />
          <path d="M-6 -2h12M-6 2h12M-1.5 -6v12" />
        </>
      )}
      {k === 1 && <path d="M-6.5 4 -2 -5h4l4.5 9zm2.4 0h9.2M-2 -5l4.5 9" />}
      {k === 2 && (
        <>
          <path d="M-4.5 -6.5h6l3 3v10h-9z" />
          <path d="M-2 0h4.5M-2 3h4.5" />
        </>
      )}
      {k === 3 && (
        <>
          <circle cx="-1" cy="-1" r="4.5" />
          <path d="M2.4 2.4 6 6" />
        </>
      )}
    </g>
  );
}
