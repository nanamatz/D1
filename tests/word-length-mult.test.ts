import { describe, it, expect } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { scoreWord, wordLengthMult } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { accumulate } from '../src/ui/settle';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import type { Letter, ScoreEvent, Tile } from '../src/engine/types';

let idc = 0;
const tile = (letter: Letter): Tile => ({
  id: `w${idc++}`,
  letter,
  material: 'ceramic',
  font: 'medium',
});
const tiles = (word: string): Tile[] =>
  [...word.toUpperCase()].map((ch) => tile(ch as Letter));

const lex = makeLexicon(['cat', 'run'], {
  run: { suit: 'slang', pos: ['verbIntransitive'] },
});

describe('wordLengthMult — length adds to Mult (GDD §3.1, 2026-07-30)', () => {
  it('adds multPerLetter per letter for a valid word', () => {
    expect(wordLengthMult(3, false)).toBe(3 * BALANCE.wordLength.multPerLetter);
  });

  it('adds nothing for gibberish (GDD §6.4 — chips × 1.0, no multipliers)', () => {
    expect(wordLengthMult(8, true)).toBe(0);
  });

  it('is zero for an empty submission', () => {
    expect(wordLengthMult(0, false)).toBe(0);
  });
});

describe('scoreWord folds the length bonus into layer 1', () => {
  it('adds length to the suit multiplier, not multiplying by it', () => {
    // CAT = C(9)+A(3)+T(3) = 15 chips; standard ×1.0; length 3
    //   => 15 × (1.0 + 3) = 60
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(60);
  });

  it('keeps the suit multiplier meaningful alongside it', () => {
    // RUN = R(3)+U(3)+N(3) = 9 chips; slang ×2.0; length 3
    //   => 9 × (2.0 + 3) = 45
    expect(scoreWord(tiles('run'), lex).settledScore).toBe(45);
  });

  it('leaves gibberish on chips × 1.0', () => {
    // ZZZ is not in the lexicon: Z(30)×3 = 90 chips × 1.0, no length bonus
    expect(scoreWord(tiles('zzz'), lex).settledScore).toBe(90);
  });
});

describe('the length beat lands in the settle timeline', () => {
  it('ADDS to the running mult, like every other delta event', () => {
    // accumulate's real signature is (chips, mult, event) => { chips, mult },
    // not the (state, event) shape the brief sketched — adapted here.
    const e: ScoreEvent = { kind: 'wordLength', letters: 5, multDelta: 5 };
    expect(accumulate(20, 1, e)).toEqual({ chips: 20, mult: 6 });
  });

  it('does not touch chips', () => {
    const e: ScoreEvent = { kind: 'wordLength', letters: 3, multDelta: 3 };
    expect(accumulate(15, 1, e).chips).toBe(15);
  });
});

/**
 * Regression pin for the Glass-ordering bug (task-6 fix): scoreWord (the pure
 * reference path) and submitWord (the live loop.ts pipeline) must apply the
 * length bonus in the same position relative to the per-tile material loop —
 * otherwise a MULTIPLICATIVE material (Glass) makes the two pipelines score
 * the same word differently. Both now apply materials first, then add length
 * (see scoring.ts::scoreWord's comment). An additive material (porcelain,
 * polished) would not have caught this, because addition commutes; only a
 * multiplicative one exposes the ordering.
 */
describe('scoreWord/submitWord parity on a multiplicative material (Glass)', () => {
  it('a word carrying a Glass tile settles identically through both pipelines', () => {
    const t = tiles('cat');
    t[0]!.material = 'glass';

    const reference = scoreWord(t, lex).settledScore;

    const run = newRun('wl-parity');
    const blind = { ...startBlind(run, makeRng('wl-parity')), hand: t };
    const live = submitWord(blind, run, lex, t.map((x) => x.id), makeRng('wl-parity-roll'))
      .submission.settledScore;

    // CAT = 15 chips; glass doubles the suit mult only: (1.0 × 2) + length 3 = 5.0
    // => 15 × 5.0 = 75
    expect(reference).toBe(75);
    expect(live).toBe(reference);
  });
});
