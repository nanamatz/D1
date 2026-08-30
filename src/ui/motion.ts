/**
 * The one reduced-motion predicate for the whole UI.
 *
 * There are TWO sources and both must be honored:
 *   - the OS setting, via `prefers-reduced-motion: reduce`
 *   - the in-game Options toggle, which `settings.ts` applies as a
 *     `force-reduced-motion` class on `<body>`
 *
 * This existed as twelve separate copies with two different definitions: seven
 * checked both, five checked only the media query. The five that skipped the
 * class were `settle.tsx`, `useAnim.ts`, `useGame.ts`, `MoneyValue.tsx` and
 * `Sidebar.tsx` — i.e. the settle timeline (the longest animation in the game),
 * every score count-up, the money pop, the tomato idle hop, and the blind-end
 * verdict pacing. Turning the option ON stopped card drag and desk objects and
 * left the scoreboard animating exactly as before. One helper, one answer.
 *
 * No `window` (Node/tests/SSR) reads as motion-off: there is nothing to animate,
 * and every call site's shape is `if (motionOff()) applyInstantly()`, so the
 * instant branch is always the safe one.
 *
 * This imperative predicate remains for timers, layout effects, and handlers.
 * Components that must react immediately to an OS preference change use the
 * subscription below in addition to their in-game setting.
 */
export function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true ||
    document.body.classList.contains('force-reduced-motion')
  );
}

const prefersReducedMotion = (): boolean =>
  typeof window === 'undefined'
    ? true
    : window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;

const subscribeReducedMotion = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
};

/** Reactively follows the OS preference; SSR takes the safe motion-off branch. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => true);
}
import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
