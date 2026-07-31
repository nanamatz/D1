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
 * Deliberately NOT a hook and NOT React state: it is read inside timers, layout
 * effects and event handlers that must see the value at the moment they run, not
 * the value captured when a component last rendered. Same reasoning as
 * `readTips()` in settings.ts.
 */
export function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    document.body.classList.contains('force-reduced-motion')
  );
}
