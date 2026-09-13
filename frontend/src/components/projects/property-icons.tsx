/*
 * The three glyphs the property picker draws, on the same 16px grid and 1.5
 * stroke as `ui/icons.tsx`. A separate file rather than entries there because
 * these are picker decoration for one menu, not part of the app's icon set —
 * and because `add-property-menu.tsx` is at the 150-line cap without them.
 */
export type PropertyIconKind =
  | "text"
  | "calendar"
  | "palette"
  | "hash"
  | "status"
  | "flag"
  | "people"
  | "emoji"
  | "files"
  /* The task drawer's rows — Tags, Delay, Parent-task and Sprint. */
  | "tag"
  | "clock"
  | "arrow"
  | "sprint";

export function PropertyIcon({ kind }: { kind: PropertyIconKind }) {
  const paths = {
    text: <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />,
    calendar: (
      <>
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
        <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
      </>
    ),
    hash: <path d="M5.5 2.5L4 13.5M11 2.5L9.5 13.5M2.5 5.5h11M2 10.5h11" />,
    status: (
      <>
        <circle cx="8" cy="8" r="5.5" strokeDasharray="2.5 2" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
      </>
    ),
    flag: <path d="M4 14V2.5h8l-1.5 2.75L12 8H4" />,
    people: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <path d="M1.5 13.5a4.5 4.5 0 019 0" />
        <path d="M10.5 4a2.5 2.5 0 010 4M11.5 13.5a4.5 4.5 0 00-1.2-3" />
      </>
    ),
    emoji: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M5.75 9.5a2.75 2.75 0 004.5 0" />
        <path d="M6 6.25v.5M10 6.25v.5" />
      </>
    ),
    files: (
      <>
        <path d="M8.5 2.5H4.5v11h7V5.5L8.5 2.5z" />
        <path d="M8.5 2.5v3h3" />
      </>
    ),
    palette: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <circle cx="8" cy="5.5" r="0.75" fill="currentColor" />
        <circle cx="5.5" cy="9" r="0.75" fill="currentColor" />
        <circle cx="10.5" cy="9" r="0.75" fill="currentColor" />
      </>
    ),
    tag: (
      <>
        <path d="M2.5 2.5h5l6 6-5 5-6-6v-5z" />
        <circle cx="5.25" cy="5.25" r="0.75" fill="currentColor" />
      </>
    ),
    clock: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3l2 1.5" />
      </>
    ),
    arrow: <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />,
    sprint: (
      <>
        <circle cx="5.5" cy="4" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="4" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="5.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="5.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-3.5 shrink-0 text-text-subtle"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}
