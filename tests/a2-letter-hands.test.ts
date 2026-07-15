import { describe, it, expect } from 'vitest';
import { evaluateLetterHand, LETTER_HAND_REGISTRY } from '../src/engine/letterHands';
import { BALANCE } from '../src/engine/balance';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import type { Letter, Tile } from '../src/engine/types';

/** Convenience: evaluate the hand for a spelled string (uppercased letters). */
const hand = (s: string, gibberish = false) => evaluateLetterHand(s.toUpperCase(), gibberish);

describe('A-2 letter hands — matching + highest-only rule', () => {
  it('LEVEL → Palindrome (not Twin)', () => {
    expect(hand('LEVEL')?.id).toBe('palindrome');
  });

  it('BANANA → Triplet (A ×3)', () => {
    expect(hand('BANANA')?.id).toBe('triplet');
  });

  it('BOOK → Twin (adjacent OO, valid word)', () => {
    expect(hand('BOOK')?.id).toBe('twin');
  });

  it('LETTERS → Longword beats the adjacent-TT Twin (highest only)', () => {
    expect(hand('LETTERS')?.id).toBe('longword');
  });

  it('EDUCATION → Vowel Flush beats Longword (highest only)', () => {
    expect(hand('EDUCATION')?.id).toBe('vowelFlush');
  });

  it('QRSTUV → Straight (6 consecutive alphabet values)', () => {
    expect(hand('QRSTUV')?.id).toBe('straight');
  });

  it('a plain short word matches nothing', () => {
    expect(hand('CAT')).toBeNull();
  });
});

describe('A-2 letter hands — gibberish eligibility', () => {
  it('Vowel Flush and Straight fire on gibberish', () => {
    expect(hand('QRSTUV', true)?.id).toBe('straight');
    expect(hand('AEIOU', true)?.id).toBe('vowelFlush');
  });

  it('Twin / Triplet / Longword / Palindrome do NOT fire on gibberish', () => {
    expect(hand('XOOZ', true)).toBeNull(); // adjacent OO but gibberish → no Twin
    expect(hand('ZAAAP', true)).toBeNull(); // A ×3 but gibberish → no Triplet
    expect(hand('ZXCVBNML', true)).toBeNull(); // 8 letters but gibberish → no Longword (no straight run)
    expect(hand('ZOOZ', true)).toBeNull(); // palindrome but gibberish → no Palindrome
  });
});

describe('A-2 letter hands — bonus values come from balance.ts', () => {
  it('returns the balance-keyed chips/mult for the match', () => {
    const m = hand('EDUCATION');
    expect(m).not.toBeNull();
    expect(m!.chips).toBe(BALANCE.letterHands.vowelFlush.chips);
    expect(m!.mult).toBe(BALANCE.letterHands.vowelFlush.mult);
  });

  it('every registered hand has a balance entry', () => {
    for (const def of LETTER_HAND_REGISTRY) {
      expect(BALANCE.letterHands[def.id]).toBeDefined();
    }
  });
});

describe('A-2 letter hands — folded into word settlement (loop.ts)', () => {
  let idc = 0;
  const tile = (letter: Letter): Tile => ({
    id: `lh${idc++}`,
    letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  });
  const handOf = (letters: Letter[]) => {
    const run = newRun('lh');
    const blind = startBlind(run, makeRng('lh'));
    return { run, blind: { ...blind, hand: [...letters.map(tile), ...blind.hand] } };
  };

  it('BOOK (valid word) adds the Twin bonus before the suit multiplier', () => {
    const lex = makeLexicon(['book'], {});
    const { run, blind } = handOf(['B', 'O', 'O', 'K']);
    const ids = blind.hand.slice(0, 4).map((t) => t.id);
    const { submission } = submitWord(blind, run, lex, ids);
    // chips: B3+O1+O1+K5 = 10, +Twin 10 = 20 · mult: standard 1.0 (+0) → 20
    expect(submission.text).toBe('BOOK');
    expect(submission.isGibberish).toBe(false);
    expect(submission.settledScore).toBe(20);
  });

  it('gibberish QRSTUV fires Straight, stays a hole (suit/POS null)', () => {
    const lex = makeLexicon(['book'], {}); // QRSTUV is not a word
    const { run, blind } = handOf(['Q', 'R', 'S', 'T', 'U', 'V']);
    const ids = blind.hand.slice(0, 6).map((t) => t.id);
    const { submission } = submitWord(blind, run, lex, ids);
    // chips: Q10+R1+S1+T1+U1+V4 = 18, +Straight 60 = 78 · mult: gibberish 1.0 +4 = 5 → 390
    expect(submission.isGibberish).toBe(true);
    expect(submission.suit).toBeNull();
    expect(submission.posUsed).toBeNull();
    expect(submission.settledScore).toBe(390);
  });
});
