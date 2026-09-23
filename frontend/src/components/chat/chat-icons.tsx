/*
 * The chat screen's own glyphs.
 *
 * Its own file rather than additions to `ui/nav-icons.tsx`: those are the
 * sidebar's, drawn at 16px on a 16-unit grid and shared by every screen. These
 * are the header and composer chips, and three of the four draw things — a
 * phone, a camera, a paperclip — that nothing else in this app has a name for.
 *
 * All on the same 16-unit box, `currentColor`, 1.5 stroke, so they sit in a
 * chip and inherit its ink like the rest of the icon set.
 */

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
    >
      {children}
    </svg>
  );
}

export function SearchGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5l3 3" />
    </Icon>
  );
}

export function PhoneGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      {/* One stroke, the handset's curve — a filled receiver at 16px turns into
          a blob, so this keeps the outline the rest of the set uses. */}
      <path d="M4.2 2.5h2l1 2.5-1.3 1a7.5 7.5 0 003.6 3.6l1-1.3 2.5 1v2a1.2 1.2 0 01-1.3 1.2A10.7 10.7 0 013 4.3 1.2 1.2 0 014.2 2.5z" />
    </Icon>
  );
}

export function VideoGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="4" width="9" height="8" rx="2" />
      <path d="M10.5 7.5l4-2v5l-4-2z" />
    </Icon>
  );
}

export function MoreGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Dots as short strokes rather than circles: `strokeLinecap="round"` on
          a zero-length path is a dot, and it stays crisp at any size. */}
      <path d="M4 8h.01M8 8h.01M12 8h.01" />
    </Icon>
  );
}

export function PlusGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Icon>
  );
}

export function EmojiGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 9.5a3 3 0 005 0M6 6.2h.01M10 6.2h.01" />
    </Icon>
  );
}

export function ClipGlyph(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.5 7.5l-4 4a2.5 2.5 0 01-3.5-3.5l5-5a1.7 1.7 0 012.4 2.4l-5 5a.8.8 0 01-1.2-1.2l4.3-4.3" />
    </Icon>
  );
}
