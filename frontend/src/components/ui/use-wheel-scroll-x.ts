"use client";

import { useEffect, type RefObject } from "react";

/**
 * A vertical mouse wheel over a horizontal rail scrolls it SIDEWAYS, smoothly.
 *
 * Without this, a wheel over a board's column rail does nothing unless Shift is
 * held — which nobody discovers. The wheel's distance is added to a target and
 * `scrollLeft` eases toward it every frame, so notched mouse wheels glide
 * instead of jumping 100px per click.
 *
 * THE PAGE STILL SCROLLS WHEN THE RAIL CANNOT. At either end, or on a rail
 * that does not overflow, the event is left alone and the page scrolls
 * vertically as usual — hijacking every wheel over a wide board would trap
 * the pointer. A mostly-horizontal gesture (trackpad swipe, Shift+wheel) is
 * also left to the browser, which already scrolls it natively.
 *
 * `passive: false` because `preventDefault` is the whole point, and React's
 * `onWheel` is passive. `prefers-reduced-motion` jumps straight to the target.
 * `scrollLeft` is written directly, never through state — same reason as
 * `use-board-pan.ts`.
 */
const EASE = 0.2;

export function useWheelScrollX(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let target = element.scrollLeft;
    let frame = 0;

    function step() {
      if (!element) return;
      const distance = target - element.scrollLeft;
      if (Math.abs(distance) < 0.5) {
        element.scrollLeft = target;
        frame = 0;
        return;
      }
      element.scrollLeft += distance * EASE;
      frame = requestAnimationFrame(step);
    }

    function onWheel(event: WheelEvent) {
      if (!element || event.ctrlKey) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

      const max = element.scrollWidth - element.clientWidth;
      if (max <= 0) return;

      /* Line-mode wheels (Firefox) report lines, not pixels. */
      const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
      /* Start from where the rail really is when no glide is running — a
         scrollbar drag or keyboard scroll may have moved it since. */
      const from = frame ? target : element.scrollLeft;
      if ((delta < 0 && from <= 0) || (delta > 0 && from >= max)) return;

      event.preventDefault();
      target = Math.min(max, Math.max(0, from + delta));

      if (reduced.matches) {
        element.scrollLeft = target;
      } else if (!frame) {
        frame = requestAnimationFrame(step);
      }
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}
