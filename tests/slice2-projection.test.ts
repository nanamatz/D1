import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord, canEndEarly } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import type { Letter, Tile } from '../src/engine/types';

const lex = makeLexicon(['cat'], {
  run: { suit: 'slang', pos: ['verbIntransitive'] },
});

let idc = 0;
const tile = (letter: Letter): Tile => ({
  id: `p${idc++}`,
  letter,
  case: 'upper',
  material: 'ceramic',
  font: 'medium',
});

/** A blind whose opening hand begins with the given word's tiles. */
const blindSpelling = (word: string, target: number) => {
  const run = newRun('proj');
  const base = startBlind(run, makeRng('proj'), { target });
  const head = [...word.toUpperCase()].map((c) => tile(c as Letter));
  return { run, blind: { ...base, hand: [...head, ...base.hand.slice(head.length)] } };
};

describe('slice2 — early-end trigger (GDD §7.2)', () => {
  const base = startBlind(newRun('t'), makeRng('t'), { target: 20 });

  it('is inactive while projected < target', () => {
    expect(canEndEarly({ ...base, projectedScore: 19 })).toBe(false);
  });

  it('activates exactly when projected reaches the target', () => {
    expect(canEndEarly({ ...base, projectedScore: 20 })).toBe(true);
  });

  it('stays active once projected exceeds the target', () => {
    expect(canEndEarly({ ...base, projectedScore: 25 })).toBe(true);
  });
});

describe('slice2 — projected score split (GDD §7.1)', () => {
  it('starts a blind with the trigger inactive (projected 0 < target)', () => {
    const { blind } = blindSpelling('cat', 5);
    expect(blind.projectedScore).toBe(0);
    expect(canEndEarly(blind)).toBe(false);
  });

  it('submitting a word updates projected and can arm the early end', () => {
    const { run, blind } = blindSpelling('cat', 5); // CAT = 15, target 5
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(blind, run, lex, ids, makeRng('test'));
    expect(after.projectedScore).toBe(15);
    expect(canEndEarly(after)).toBe(true);
  });

  it('flows the suit multiplier into projected (RUN slang ×2 = 18 ≥ 6)', () => {
    const { run, blind } = blindSpelling('run', 6);
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(blind, run, lex, ids, makeRng('test'));
    expect(after.committedScore).toBe(18);
    expect(canEndEarly(after)).toBe(true);
  });

  it('keeps projected == committed each phase — overwrite, not accumulate (no sentence bonus yet)', () => {
    const { run, blind } = blindSpelling('cat', 1000);
    const ids = blind.hand.slice(0, 3).map((t) => t.id);
    const { blind: after } = submitWord(blind, run, lex, ids, makeRng('test'));
    // Sentence projection is slice ③; until then projected mirrors committed.
    expect(after.projectedScore).toBe(after.committedScore);
  });
});
