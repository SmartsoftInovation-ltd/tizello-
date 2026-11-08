"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import confetti from "canvas-confetti";

/* 5 seconds of bursts, twice the particles it started with, larger pieces
   that linger longer — a celebration you notice, still over before it gets in
   the way. Reduced-motion users get none of it (below). */
const DURATION_MS = 5000;
const TICK_MS = 250;
const BASE_PARTICLE_COUNT = 200;

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

/**
 * The canvas-confetti "fireworks" preset (kirilv.com/canvas-confetti), fired
 * once right after a login lands on the board — `?welcome=1` is what
 * `homeWithWelcome()` (`lib/session-cookie.ts`) appends to the redirect after
 * password/code sign-in and after registration-code verification.
 *
 * Renders nothing itself; the whole job is the effect. The query param is
 * stripped via `router.replace` in the same effect run, not a separate one —
 * a page refresh must not replay the fireworks, and stripping it any later
 * risks a second render seeing the param still there.
 */
export function WelcomeFireworks() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    router.replace(pathname, { scroll: false });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animationEnd = Date.now() + DURATION_MS;

    /* One big burst from the centre to open, then the side fireworks. */
    confetti({ particleCount: 250, spread: 120, startVelocity: 55, scalar: 1.2, ticks: 120, zIndex: 100, origin: { x: 0.5, y: 0.6 } });

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }

      const particleCount = BASE_PARTICLE_COUNT * (timeLeft / DURATION_MS);
      const shared = { startVelocity: 35, spread: 360, ticks: 90, scalar: 1.2, zIndex: 100, particleCount };

      confetti({ ...shared, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...shared, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, TICK_MS);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once for this mount; router/pathname are stable identities from next/navigation
  }, []);

  return null;
}
