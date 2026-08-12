/**
 * Word Hands (playtest-02 A-2) — per-word letter-structure "hand types",
 * evaluated at submission. They supply the word-level dopamine (Balatro's poker
 * hands) while sentence patterns remain the run-level payoff.
 *
 * Scoring placement: the matched hand adds Chips and multiplies Mult in the
 * WordScoringContext before the word settles (see loop.ts). Highest
 * single hand only (consistent with the sentence-pattern rule, GDD §5.1).
 *
 * Gibberish eligibility (A-2): Vowel Flush and Straight fire on gibberish too
 * (a deliberate jackpot — e.g. dumping Q-R-S-T-U-V); Twin, Triplet, Longword and
 * Palindrome are valid-words-only.
 *
 * Pure over an uppercase A–Z letter string — no lexicon, no DOM.
 */

import { BALANCE } from './balance';
import { VOWELS, type Letter, type LetterHandId } from './types';

export type { LetterHandId } from './types';

export interface LetterHandDef {
  id: LetterHandId;
  rank: number; // 1 (weakest) .. 9 (strongest) — highest single hand wins
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

export const KNOWLEDGE_LETTER_HAND_IDS = [
  'typeEconomy',
  'vowelless',
  'grandPalindrome',
] as const satisfies readonly LetterHandId[];

export const isKnowledgeLetterHand = (id: LetterHandId): boolean =>
  KNOWLEDGE_LETTER_HAND_IDS.includes(id as (typeof KNOWLEDGE_LETTER_HAND_IDS)[number]);

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

const isVowelFlush = (s: string): boolean => [...VOWELS].every((v) => s.includes(v));

const hasNoRepeatedLetters = (s: string): boolean =>
  s.length >= BALANCE.letterHand.typeEconomyMinLen && new Set(s).size === s.length;

const isVowelless = (s: string): boolean => {
  const minLength = VOWELS.has('Y')
    ? BALANCE.letterHand.vowellessMinLenWhenYVowel
    : BALANCE.letterHand.vowellessMinLenWhenYConsonant;
  return s.length >= minLength && [...s].every((letter) => !VOWELS.has(letter as Letter));
};

const isGrandPalindrome = (s: string): boolean =>
  s.length >= BALANCE.letterHand.grandPalindromeMinLen && s === [...s].reverse().join('');

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
  {
    id: 'longword',
    rank: BALANCE.letterHands.longword.rank,
    gibberish: false,
    test: (s) => s.length >= BALANCE.letterHand.longwordLen,
  },
  { id: 'triplet', rank: BALANCE.letterHands.triplet.rank, gibberish: false, test: hasTriple },
  { id: 'palindrome', rank: BALANCE.letterHands.palindrome.rank, gibberish: false, test: isPalindrome },
  { id: 'vowelFlush', rank: BALANCE.letterHands.vowelFlush.rank, gibberish: true, test: isVowelFlush },
  { id: 'straight', rank: BALANCE.letterHands.straight.rank, gibberish: true, test: hasStraight },
  {
    id: 'typeEconomy',
    rank: BALANCE.letterHands.typeEconomy.rank,
    gibberish: false,
    test: hasNoRepeatedLetters,
  },
  { id: 'vowelless', rank: BALANCE.letterHands.vowelless.rank, gibberish: false, test: isVowelless },
  {
    id: 'grandPalindrome',
    rank: BALANCE.letterHands.grandPalindrome.rank,
    gibberish: false,
    test: isGrandPalindrome,
  },
];

/**
 * The highest-rank Word Hand for an uppercase A–Z string, or null. When
 * `isGibberish`, only gibberish-eligible hands are considered.
 */
export function evaluateLetterHand(
  letters: string,
  isGibberish: boolean,
  effectiveLength = letters.length,
): LetterHandMatch | null {
  let best: LetterHandMatch | null = null;
  for (const def of LETTER_HAND_REGISTRY) {
    if (isGibberish && !def.gibberish) continue;
    if (def.id === 'longword'
      ? effectiveLength < BALANCE.letterHand.longwordLen
      : !def.test(letters)) continue;
    if (!best || def.rank > best.rank) {
      const b = BALANCE.letterHands[def.id];
      best = { id: def.id, rank: def.rank, chips: b.chips, mult: b.mult };
    }
  }
  return best;
}
