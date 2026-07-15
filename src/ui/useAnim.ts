/**
 * Small animation hooks for the settle juice (UI_DESIGN §4). Pure presentation —
 * they read the engine's ScoreEvent log and drive display values with timers.
 * All honor prefers-reduced-motion (instant, no motion).
 */
import { useEffect, useRef, useState } from 'react';

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ease a displayed number toward `value` whenever it changes (committed/projected roll). */
export function useCountUp(value: number, duration = 420): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reducedMotion() || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}

/**
 * Reveal `count` items one at a time on a fixed cadence (Cash Out line-by-line,
 * spec §2.5). Returns how many are currently visible. Reduced motion reveals all
 * at once.
 */
export function useReveal(count: number, stepMs = 380): number {
  const [shown, setShown] = useState(reducedMotion() ? count : 0);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(count);
      return;
    }
    setShown(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= count; i++) {
      timers.push(setTimeout(() => setShown(i), i * stepMs));
    }
    return () => timers.forEach(clearTimeout);
  }, [count, stepMs]);
  return shown;
}

