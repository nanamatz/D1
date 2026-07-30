/** Shared numeric helpers for the UI layer. */

/**
 * Constrain `n` to `[lo, hi]`. `hi` is floored at `lo`, so an inverted range
 * collapses to `lo` instead of returning the wrong bound — the coach-mark
 * positioner (`spotlightPos.ts`) relies on that when a target is larger than
 * the viewport.
 */
export const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(n, Math.max(lo, hi)));
