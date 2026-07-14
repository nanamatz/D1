/**
 * Small animation hooks for the settle juice (UI_DESIGN §4). Pure presentation —
 * they read the engine's ScoreEvent log and drive display values with timers.
 * All honor prefers-reduced-motion (instant, no motion).
 */
import { useEffect, useRef, useState } from 'react';
import type { ScoreEvent } from '../engine/types';

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

export interface SettleDisplay {
  chips: number;
  mult: number;
  active: boolean;
}

/**
 * Replay a submission's ScoreEvent log as a chips/mult build-up: chips tick up
 * per tile, the suit sets the mult, jokers add their deltas, then it settles.
 * `key` (a submission counter) retriggers the replay even for identical events.
 */
export function useSettle(events: readonly ScoreEvent[], key: number): SettleDisplay {
  const [display, setDisplay] = useState<SettleDisplay>({ chips: 0, mult: 1, active: false });

  useEffect(() => {
    if (key === 0 || events.length === 0 || reducedMotion()) return;

    const frames: Array<{ chips: number; mult: number }> = [];
    let chips = 0;
    let mult = 1;
    for (const e of events) {
      if (e.kind === 'tile') chips += e.chips;
      else if (e.kind === 'suit') mult = e.mult;
      else if (e.kind === 'joker') {
        chips += e.chipsDelta;
        mult += e.multDelta;
      } else continue; // settle frame == last accumulated
      frames.push({ chips, mult });
    }
    if (frames.length === 0) return;

    const step = Math.min(120, Math.floor(760 / frames.length));
    const timers: ReturnType<typeof setTimeout>[] = [];
    setDisplay({ chips: 0, mult: frames[0]!.mult, active: true });
    frames.forEach((f, i) => {
      timers.push(setTimeout(() => setDisplay({ ...f, active: true }), (i + 1) * step));
    });
    timers.push(
      setTimeout(() => setDisplay((d) => ({ ...d, active: false })), frames.length * step + 550),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return display;
}
