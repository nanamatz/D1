import { describe, it, expect } from 'vitest';
import { settleDurationMs, accumulate } from '../src/ui/settle';
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

const material = (id: string): ScoreEvent => ({
  kind: 'material',
  material: 'porcelain',
  tileId: id,
  chipsDelta: 30,
  multDelta: 0,
});

describe('settleDurationMs — material beats extend the timeline (GDD §2.2)', () => {
  it('a porcelain word settles longer than the same word in ceramic', () => {
    const ceramic = [...Array.from({ length: 3 }, (_, i) => tile(`t${i}`)), suit(), settle()];
    const porcelain = [
      tile('t0'), material('t0'),
      tile('t1'), material('t1'),
      tile('t2'), material('t2'),
      suit(), settle(),
    ];
    expect(settleDurationMs(porcelain, 1, false)).toBeGreaterThan(
      settleDurationMs(ceramic, 1, false),
    );
  });

  it('scales with speed like every other beat — never a fixed delay', () => {
    const beats = [tile('t0'), material('t0'), suit(), settle()];
    expect(settleDurationMs(beats, 1, false)).toBeGreaterThan(settleDurationMs(beats, 4, false));
  });
});

/**
 * The critical bug: a `material` event with a nonzero multDelta (Polished,
 * Glass, mult-rolling Lead plate) lands in the log BEFORE `suit`, because
 * those materials mutate ctx.mult in the per-tile loop that precedes the
 * `suit` push (loop.ts). If the UI folds `suit` as an OVERWRITE
 * (`mult = e.mult`) instead of an accumulation, the material's contribution
 * is wiped out the instant `suit` is folded. `accumulate` must ADD every
 * mult-bearing event, `suit` included, so folding is order-independent.
 */
describe('accumulate — the chips/mult fold shared by both settle timelines', () => {
  const materialMult = (id: string, multDelta: number): ScoreEvent => ({
    kind: 'material',
    material: 'glass',
    tileId: id,
    chipsDelta: 0,
    multDelta,
  });

  it('a material multDelta preceding suit is NOT wiped out by the suit fold', () => {
    // Engine order for a Glass tile: tile, material(+1 multDelta, i.e. the
    // ctx.mult ×2 step captured as a delta around the suit-inclusive base),
    // suit, settle. UI starts at mult=0, so folding must land at 1 (material)
    // + 1 (suit) = 2 — matching the engine's post-suit ctx.mult of 2.0.
    const events: ScoreEvent[] = [
      tile('t0'),
      materialMult('t0', 1),
      suit(),
      settle(),
    ];
    let chips = 0;
    let mult = 0;
    for (const e of events) {
      if (e.kind === 'settle') continue;
      ({ chips, mult } = accumulate(chips, mult, e));
    }
    expect(mult).toBe(2);
  });

  it('a ceramic word (no material beats) still lands mult=1 from suit alone', () => {
    const events: ScoreEvent[] = [tile('t0'), suit(), settle()];
    let chips = 0;
    let mult = 0;
    for (const e of events) {
      if (e.kind === 'settle') continue;
      ({ chips, mult } = accumulate(chips, mult, e));
    }
    expect(chips).toBe(10);
    expect(mult).toBe(1);
  });

  it('tile chips accumulate additively regardless of material/suit folding', () => {
    const events: ScoreEvent[] = [
      tile('t0'),
      materialMult('t0', 1),
      suit(),
      settle(),
    ];
    let chips = 0;
    let mult = 0;
    for (const e of events) {
      if (e.kind === 'settle') continue;
      ({ chips, mult } = accumulate(chips, mult, e));
    }
    expect(chips).toBe(10);
  });
});
