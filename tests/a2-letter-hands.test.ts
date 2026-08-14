import { describe, it, expect } from 'vitest';
import { evaluateLetterHand, LETTER_HAND_REGISTRY } from '../src/engine/letterHands';
import { BALANCE } from '../src/engine/balance';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import { VOWELS, type Letter, type Tile } from '../src/engine/types';

/** Convenience: evaluate the hand for a spelled string (uppercased letters). */
const hand = (s: string, gibberish = false) => evaluateLetterHand(s.toUpperCase(), gibberish);

describe('A-2 letter hands — matching + highest-only rule', () => {
  it('LEVEL → Palindrome (not Twin)', () => {
    expect(hand('LEVEL')?.id).toBe('palindrome');
  });

  it('MAMMA → Triplet (M ×3)', () => {
    expect(hand('MAMMA')?.id).toBe('triplet');
  });

  it('BANANA → Triplet outranks Longword', () => {
    expect(hand('BANANA')?.id).toBe('triplet');
  });

  it('BOOK → Twin (adjacent OO, valid word)', () => {
    expect(hand('BOOK')?.id).toBe('twin');
  });

  it('LETTER → Longword at 6 letters beats the adjacent-TT Twin (highest only)', () => {
    expect(hand('LETTER')?.id).toBe('longword');
    expect(hand('PLANE')).toBeNull();
  });

  it('SEQUOIA → Vowel Flush beats Longword (highest only)', () => {
    expect(hand('SEQUOIA')?.id).toBe('vowelFlush');
  });

  it('QRSTU → Straight (5 consecutive alphabet values)', () => {
    expect(hand('QRSTU')?.id).toBe('straight');
  });

  it('DIALOGUE → Type Economy above Vowel Flush', () => {
    expect(hand('DIALOGUE')?.id).toBe('typeEconomy');
  });

  it('RHYTHM → Vowelless with Y treated as a consonant', () => {
    expect(VOWELS.has('Y')).toBe(false);
    expect(hand('RHYTHM')?.id).toBe('vowelless');
  });

  it('ROTATOR → Grand Palindrome above Palindrome and Longword', () => {
    expect(hand('ROTATOR')?.id).toBe('grandPalindrome');
  });

  it('new physical-length thresholds ignore Dummy Data effective length', () => {
    expect(evaluateLetterHand('ACEGIK', false, 8)?.id).toBe('longword');
    expect(evaluateLetterHand('BCDF', false, 8)?.id).toBe('longword');
    expect(evaluateLetterHand('RADAR', false, 8)?.id).toBe('palindrome');
  });

  it('a plain short word matches nothing', () => {
    expect(hand('CAT')).toBeNull();
  });
});

describe('A-2 letter hands — gibberish eligibility', () => {
  it('Vowel Flush and Straight fire on gibberish', () => {
    expect(hand('QRSTU', true)?.id).toBe('straight');
    expect(hand('AEIOU', true)?.id).toBe('vowelFlush');
  });

  it('every valid-only hand stays disabled on gibberish', () => {
    expect(hand('XOOZ', true)).toBeNull(); // adjacent OO but gibberish → no Twin
    expect(hand('ZAAAP', true)).toBeNull(); // A ×3 but gibberish → no Triplet
    expect(hand('ZXCVBNML', true)).toBeNull(); // 8 letters but gibberish → no Longword (no straight run)
    expect(hand('ZOOZ', true)).toBeNull(); // palindrome but gibberish → no Palindrome
    expect(hand('BCDFG', true)).toBeNull(); // no vowels, but gibberish → no Vowelless
    expect(hand('ABCDWXYZ', true)).toBeNull(); // unique 8 letters, but gibberish → no Type Economy
    expect(hand('ABCDCBA', true)).toBeNull(); // 7-letter palindrome, but gibberish → no Grand Palindrome
  });
});

describe('A-2 letter hands — bonus values come from balance.ts', () => {
  it('returns the balance-keyed chips/mult for the match', () => {
    const m = hand('SEQUOIA');
    expect(m).not.toBeNull();
    expect(m!.chips).toBe(BALANCE.letterHands.vowelFlush.chips);
    expect(m!.mult).toBe(BALANCE.letterHands.vowelFlush.mult);
  });

  it('every registered hand has a balance entry', () => {
    expect(LETTER_HAND_REGISTRY).toHaveLength(9);
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
    material: 'ceramic',
    font: 'medium',
  });
  const handOf = (letters: Letter[]) => {
    const run = newRun('lh');
    const blind = startBlind(run, makeRng('lh'));
    return { run, blind: { ...blind, hand: [...letters.map(tile), ...blind.hand] } };
  };

  it('BOOK adds Twin Chips and multiplies the current word Mult', () => {
    const lex = makeLexicon(['book'], {});
    const { run, blind } = handOf(['B', 'O', 'O', 'K']);
    run.letterHandPlayCounts = { twin: 2 };
    const ids = blind.hand.slice(0, 4).map((t) => t.id);
    const { submission, events, letterHandPlayCounts } = submitWord(blind, run, lex, ids, makeRng('test'));
    // chips: B9+O3+O3+K15 = 30, +Twin 15 = 45
    // mult: (standard 1.0 + length 4) × Twin 1 = 5.0 => 45 × 5.0 = 225
    expect(submission.text).toBe('BOOK');
    expect(submission.isGibberish).toBe(false);
    expect(submission.settledScore).toBe(225);
    expect(events).toContainEqual({
      kind: 'letterHand', hand: 'twin', level: 1, chipsDelta: 15, multDelta: 0, multFactor: 1,
    });
    expect(letterHandPlayCounts.twin).toBe(3);
  });

  it('submitting a six-letter triple records and announces Triplet', () => {
    const lex = makeLexicon(['banana'], {});
    const { run, blind } = handOf(['B', 'A', 'N', 'A', 'N', 'A']);
    const ids = blind.hand.slice(0, 6).map((t) => t.id);
    const { events, letterHandPlayCounts } = submitWord(blind, run, lex, ids, makeRng('triplet'));

    expect(events).toContainEqual(expect.objectContaining({
      kind: 'letterHand',
      hand: 'triplet',
      chipsDelta: BALANCE.letterHands.triplet.chips,
      multFactor: BALANCE.letterHands.triplet.mult,
    }));
    expect(letterHandPlayCounts.triplet).toBe(1);
    expect(letterHandPlayCounts.longword).toBeUndefined();
  });

  it('gibberish QRSTU fires Straight, stays a hole (suit/POS null)', () => {
    const lex = makeLexicon(['book'], {}); // QRSTU is not a word
    const { run, blind } = handOf(['Q', 'R', 'S', 'T', 'U']);
    const ids = blind.hand.slice(0, 5).map((t) => t.id);
    const { submission, events } = submitWord(blind, run, lex, ids, makeRng('test'));
    // chips: Q30+R3+S3+T3+U3 = 42, +Straight 90 = 132; mult: gibberish 1.0 ×5 = 5
    expect(submission.isGibberish).toBe(true);
    expect(submission.suit).toBeNull();
    expect(submission.posUsed).toBeNull();
    expect(submission.settledScore).toBe(660);
    expect(events).toContainEqual({
      kind: 'letterHand', hand: 'straight', level: 1, chipsDelta: 90, multDelta: 4, multFactor: 5,
    });
  });

  it('uses the current Word Hand level for Chips and Mult', () => {
    const lex = makeLexicon(['book'], {});
    const { run, blind } = handOf(['B', 'O', 'O', 'K']);
    run.letterHandLevels = { ...run.letterHandLevels, twin: 4 };
    const ids = blind.hand.slice(0, 4).map((t) => t.id);
    const { submission, events } = submitWord(blind, run, lex, ids, makeRng('leveled-twin'));

    expect(submission.settledScore).toBe(600);
    expect(events).toContainEqual({
      kind: 'letterHand', hand: 'twin', level: 4, chipsDelta: 30, multDelta: 5, multFactor: 2,
    });
  });
});
