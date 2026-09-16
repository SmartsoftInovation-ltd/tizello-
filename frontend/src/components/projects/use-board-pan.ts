"use client";

import { useRef, useState, type RefObject } from "react";

/**
 * Grab the board's background and drag it sideways.
 *
 * WHY THIS EXISTS: the rail's horizontal scrollbar is hidden
 * (`scrollbar-hidden`), so something else has to advertise and provide the
 * scroll. A mouse wheel alone does not — a vertical wheel over a horizontal
 * overflow does nothing without Shift, which nobody discovers. Grab-and-drag
 * is the gesture every board tool uses for exactly this (Figma's canvas,
 * Trello's rail), and a `cursor-grab` on the background is the advertisement.
 *
 * WHAT IT MUST NOT TOUCH. A card is dnd-kit's, and the two gestures start
 * identically — press, then move. They are told apart by WHERE the press
 * landed rather than by how far it travelled, because a threshold race would
 * make the outcome depend on how fast the pointer left the card. `IGNORE`
 * lists what belongs to something else: any card (`li`), any real control, and
 * anything in the top layer. Everything else — the gaps between columns, a
 * column heading, the empty space in a track — is background.
 *
 * POINTER CAPTURE, so a pan that runs off the rail keeps tracking instead of
 * stopping at the edge. That is most of a real pan: you grab near one end and
 * pull past the viewport.
 *
 * `scrollLeft` IS SET DIRECTLY, not through state. It is not React's value to
 * own — the browser already stores it on the element, and routing 60 frames a
 * second of it through a render would re-render six columns of cards per frame
 * for a number nothing else reads. Only `panning`, which the cursor depends
 * on, is state.
 */
const IGNORE = "li, a, button, input, select, textarea, [popover], [role=dialog]";

export function useBoardPan(
  ref: RefObject<HTMLElement | null>,
  /** True while a card is being dragged — the two gestures must never overlap. */
  dragging: boolean,
  /** More elements that belong to another gesture — a board whose whole columns can be dragged. */
  alsoIgnore?: string,
) {
  const [panning, setPanning] = useState(false);
  const origin = useRef({ x: 0, scrollLeft: 0 });

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    const rail = ref.current;
    /* Primary button only: a middle-click is the browser's autoscroll and a
       right-click is the context menu, and hijacking either is hostile. */
    if (!rail || dragging || event.button !== 0 || !event.isPrimary) return;
    if ((event.target as Element).closest(alsoIgnore ? `${IGNORE}, ${alsoIgnore}` : IGNORE)) return;
    /* Nothing to pan — a board narrower than its rail would otherwise show a
       grabbing cursor and then not move, which reads as broken. */
    if (rail.scrollWidth <= rail.clientWidth) return;

    origin.current = { x: event.clientX, scrollLeft: rail.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!panning || !ref.current) return;
    ref.current.scrollLeft = origin.current.scrollLeft - (event.clientX - origin.current.x);
  }

  function stop() {
    if (panning) setPanning(false);
  }

  return {
    panning,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stop,
      onPointerCancel: stop,
    },
  };
}
