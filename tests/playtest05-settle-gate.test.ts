import { describe, it, expect } from 'vitest';
import { settleDurationMs } from '../src/ui/settle';
import type { ScoreEvent } from '../src/engine/types';

/**
 * playtest-05 A: the round-clear UI is gated on the settlement-sequence completion
 * signal, never on the raw final score (recurrence of 04 A-1). The signal fires at
 * `settleDurationMs`, which must track the ACTUAL settle length — the prior bug was
 * a fixed delay that shorter than a long word's settle, so the verdict fired before
 * the count-up landed. These assert the signal timing is proportional, not fixed.
 */

const tile = (id: string): ScoreEvent => ({ kind: 'tile', tileId: id, letter: 'A', chips: 10 });
const suit = (): ScoreEvent => ({ kind: 'suit', suit: 'standard', mult: 1 });
const joker = (id: string): ScoreEvent => ({ kind: 'joker', jokerId: id, chipsDelta: 5, multDelta: 1 });
const settle = (): ScoreEvent => ({ kind: 'settle', chips: 0, mult: 0, total: 0 });

/** A submission's event log: `n` tiles + suit + `j` jokers + the settle bookkeeping frame. */
const play = (n: number, j = 0): ScoreEvent[] => [
  ...Array.from({ length: n }, (_, i) => tile(`t${i}`)),
  suit(),
  ...Array.from({ length: j }, (_, i) => joker(`j${i}`)),
  settle(),
];

describe('settleDurationMs — the clear signal tracks the settle length', () => {
  it('grows with the number of scoring beats', () => {
    const short = settleDurationMs(play(2), 1, false);
    const long = settleDurationMs(play(8, 3), 1, false);
    expect(long).toBeGreaterThan(short);
  });

  it('scales inversely with game speed', () => {
    const at1x = settleDurationMs(play(6, 2), 1, false);
    const at2x = settleDurationMs(play(6, 2), 2, false);
    expect(at2x).toBeCloseTo(at1x / 2);
  });

  it('excludes the settle bookkeeping frame from the beat count', () => {
    // Same scoring beats with/without the trailing settle frame → same duration.
    const withFrame = settleDurationMs(play(4), 1, false);
    const withoutFrame = settleDurationMs(play(4).filter((e) => e.kind !== 'settle'), 1, false);
    expect(withFrame).toBe(withoutFrame);
  });

  it('reduced motion is a constant hold, independent of beat count', () => {
    expect(settleDurationMs(play(2), 1, true)).toBe(settleDurationMs(play(12, 5), 1, true));
  });

  it('is zero when there are no scoring beats (nothing to wait for)', () => {
    expect(settleDurationMs([settle()], 1, false)).toBe(0);
    expect(settleDurationMs([], 1, false)).toBe(0);
  });

  it('a long word outlasts the old fixed 1900ms delay (the regression)', () => {
    // The bug: a fixed ~1900ms verdict delay fired before a long settle landed.
    // A 7-tile word with 2 jokers (10 beats) settles for 2150ms at 1× — the clear
    // must now wait for THIS, not a constant that undershoots it.
    const longPlay = settleDurationMs(play(7, 2), 1, false);
    expect(longPlay).toBeGreaterThan(1900);
  });
});
