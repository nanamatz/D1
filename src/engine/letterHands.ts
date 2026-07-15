/**
 * Letter Hands (playtest-02 A-2) — per-word letter-structure "hand types",
 * evaluated at submission. They supply the word-level dopamine (Balatro's poker
 * hands) while sentence patterns remain the run-level payoff.
 *
 * Scoring placement: the matched hand's +Chips / +Mult are folded into the
 * WordScoringContext before the suit multiplier settles (see loop.ts). Highest
 * single hand only (consistent with the sentence-pattern rule, GDD §5.1).
 *
 * Gibberish eligibility (A-2): Vowel Flush and Straight fire on gibberish too
 * (a deliberate jackpot — e.g. dumping Q-R-S-T-U-V); Twin, Triplet, Longword and
 * Palindrome are valid-words-only.
 *
 * Pure over an uppercase A–Z letter string — no lexicon, no DOM.
 */

import { BALANCE } from './balance';

export type LetterHandId =
  | 'twin'
  | 'triplet'
  | 'longword'
  | 'palindrome'
  | 'vowelFlush'
  | 'straight';

export interface LetterHandDef {
  id: LetterHandId;
  rank: number; // 1 (weakest) .. 6 (strongest) — highest single hand wins
  /** eligible when the submission is gibberish */
  gibberish: boolean;
  test: (letters: string) => boolean;
}

export interface LetterHandMatch {
  id: LetterHandId;
  rank: number;
  chips: number;
  mult: number;
}

const VOWELS = ['A', 'E', 'I', 'O', 'U'] as const;

/** True if the string contains two identical letters adjacent (b**OO**k). */
const hasAdjacentPair = (s: string): boolean => /(.)\1/.test(s);

/** True if any single letter appears three or more times anywhere (bAnAnA). */
function hasTriple(s: string): boolean {
  const counts: Record<string, number> = {};
  for (const ch of s) {
    counts[ch] = (counts[ch] ?? 0) + 1;
    if (counts[ch] >= 3) return true;
  }
  return false;
}

const isPalindrome = (s: string): boolean =>
  s.length >= BALANCE.letterHand.palindromeMinLen && s === s.split('').reverse().join('');

const isVowelFlush = (s: string): boolean => VOWELS.every((v) => s.includes(v));

/** True if the letters include N consecutive alphabet values (Q-R-S-T-U-V). */
function hasStraight(s: string): boolean {
  const present = new Set(s);
  let run = 0;
  for (let code = 65; code <= 90; code++) {
    run = present.has(String.fromCharCode(code)) ? run + 1 : 0;
    if (run >= BALANCE.letterHand.straightRun) return true;
  }
  return false;
}

/** Registry ordered by ascending rank (index-independent — rank drives the pick). */
export const LETTER_HAND_REGISTRY: readonly LetterHandDef[] = [
  { id: 'twin', rank: BALANCE.letterHands.twin.rank, gibberish: false, test: hasAdjacentPair },
  { id: 'triplet', rank: BALANCE.letterHands.triplet.rank, gibberish: false, test: hasTriple },
  {
    id: 'longword',
    rank: BALANCE.letterHands.longword.rank,
    gibberish: false,
    test: (s) => s.length >= BALANCE.letterHand.longwordLen,
  },
  { id: 'palindrome', rank: BALANCE.letterHands.palindrome.rank, gibberish: false, test: isPalindrome },
  { id: 'vowelFlush', rank: BALANCE.letterHands.vowelFlush.rank, gibberish: true, test: isVowelFlush },
  { id: 'straight', rank: BALANCE.letterHands.straight.rank, gibberish: true, test: hasStraight },
];

/**
 * The highest-rank letter hand for an uppercase A–Z string, or null. When
 * `isGibberish`, only gibberish-eligible hands are considered.
 */
export function evaluateLetterHand(letters: string, isGibberish: boolean): LetterHandMatch | null {
  let best: LetterHandMatch | null = null;
  for (const def of LETTER_HAND_REGISTRY) {
    if (isGibberish && !def.gibberish) continue;
    if (!def.test(letters)) continue;
    if (!best || def.rank > best.rank) {
      const b = BALANCE.letterHands[def.id];
      best = { id: def.id, rank: def.rank, chips: b.chips, mult: b.mult };
    }
  }
  return best;
}
