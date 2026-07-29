/*
 * Shared Framer Motion presets — single source of truth for the
 * animation spec's timing/easing cheat sheet.
 *
 * Only transform + opacity are animated. All springs/durations stay
 * inside the 80–260ms micro-interaction window (springs settle fast).
 */
import type { Transition } from 'framer-motion';

/** Gate JS-driven entrances on the OS reduced-motion setting. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Modal card in/out — spec §5. */
export const modalSpring: Transition = { type: 'spring', stiffness: 480, damping: 30, mass: 0.6 };

/** Sliding active-tab pill — spec §2/§6 (shared layoutId). */
export const pillSpring: Transition = { type: 'spring', stiffness: 500, damping: 35 };

/** KPI/stat card hover/tap — spec §4. */
export const cardSpring: Transition = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };

/** Icon wobble on hover — spec §4. */
export const wobbleSpring: Transition = { type: 'spring', stiffness: 520, damping: 18 };

/** Logo pop-in — spec §2. */
export const logoSpring: Transition = { type: 'spring', stiffness: 400, damping: 15 };

/** Login card entrance — spec §1. */
export const authCardSpring: Transition = { type: 'spring', stiffness: 300, damping: 25 };

/** Page/header/nav entrance — spec §3 / cheat sheet. */
export const pageEase: Transition = { duration: 0.18, ease: 'easeOut' };

/** Per-item stagger delay for lists/grids — spec §4. */
export const staggerDelay = (index: number) => index * 0.035;
