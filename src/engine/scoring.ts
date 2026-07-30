/**
 * Word scoring — layer 1 of the settlement pipeline (GDD §7.1).
 *
 * Layer 1 = chips × mult, settled immediately (GDD §7.1):
 *   - valid word     → chips × suit multiplier (GDD §3.1)
 *   - gibberish      → chips × 1.0, no suit, no POS; recorded as a hole (§6.4 b-2)
 *
 * Joker hooks (slice ④) will mutate chips/mult before the final multiply;
 * POS resolution (slice ③) fills posUsed from the pattern match. Keeping that
 * null here is intentional, not a stub.
 */

import { BALANCE } from './balance';
import type { Lexicon } from './lexicon';
import { applyTileMaterial } from './materials';
import { makeRng } from './rng';
import type { Suit, Tile, WordScoringContext, WordSubmission } from './types';

/** Sentinel glyph for a letterless Stone tile. Never appears in the lexicon, so a
 *  word containing one always fails lookup → gibberish (GDD §2.2, §6.4). */
export const NO_LETTER = '□';

/** Spell the tiles as displayed. Letter tiles are uppercase-only. */
export function spell(tiles: readonly Tile[]): string {
  return tiles.map((t) => t.letter ?? NO_LETTER).join('');
}

/**
 * The letters string fed to `evaluateLetterHand` (GDD §5.5) — the single source
 * of truth for that input, shared by the loop pipeline and the UI stage preview.
 * Letterless (Stone) tiles render as `NO_LETTER` so a stone never silently
 * vanishes from the string (which would corrupt straight/flush detection).
 *
 * Kept separate from `spell()` because it is the explicit structural input for
 * letter-hand matching, even though both currently return the same uppercase
 * string.
 */
export function letterString(tiles: readonly Tile[]): string {
  return tiles.map((t) => t.letter ?? NO_LETTER).join('');
}

/** Sum of intrinsic Scrabble letter chips (GDD §2.1). Stone contributes 0 — its
 *  chips come from the material, not the letter (GDD §2.2). */
export function letterChips(tiles: readonly Tile[]): number {
  let sum = 0;
  for (const t of tiles) sum += t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
  return sum;
}

/**
 * The Mult a word's length adds (GDD §3.1). Takes a letter COUNT, not tiles, so
 * the hint solver — which ranks word strings with no tiles in hand — shares the
 * one rule. Gibberish is excluded (§6.4): it pays chips × 1.0 with no multipliers,
 * which also handles letterless Stone tiles, since a word holding one always fails
 * lookup and is therefore gibberish.
 */
export function wordLengthMult(letterCount: number, isGibberish: boolean): number {
  return isGibberish ? 0 : letterCount * BALANCE.wordLength.multPerLetter;
}

export interface BaseScore {
  text: string;
  isGibberish: boolean;
  suit: Suit | null;
  /** base chips before joker mutation (letter sum) */
  chips: number;
  /** base mult before joker mutation (suit multiplier, or 1.0 for gibberish) */
  mult: number;
}

/**
 * The pre-joker chips/mult for a tile set (GDD §3.1, §6.4). This is the seam
 * layer-1/2 jokers mutate (via the wordScoring event) before the final
 * chips × mult settlement in the loop pipeline.
 */
export function baseScore(tiles: readonly Tile[], lexicon: Lexicon): BaseScore {
  const text = spell(tiles);
  const chips = letterChips(tiles);
  const entry = lexicon.lookup(text);
  if (entry === null) {
    return { text, isGibberish: true, suit: null, chips, mult: BALANCE.gibberish.mult };
  }
  return { text, isGibberish: false, suit: entry.suit, chips, mult: BALANCE.suitMult[entry.suit] };
}

/**
 * Score one submitted tile set into a settled WordSubmission (layer 1) with NO
 * jokers. The loop wires jokers around baseScore; this stays the pure reference.
 */
export function scoreWord(tiles: readonly Tile[], lexicon: Lexicon): WordSubmission {
  const b = baseScore(tiles, lexicon);
  const submission: WordSubmission = {
    tiles: tiles.slice(),
    text: b.text,
    isGibberish: b.isGibberish,
    suit: b.suit,
    posUsed: null,
    settledScore: 0,
  };
  // Reference path: no jokers, no bosses. Materials still apply — they are part of
  // the tile, not a modifier layered on top. Fixed seed keeps this pure/testable.
  const rng = makeRng('scoreWord');
  const ctx: WordScoringContext = {
    submission,
    chips: b.chips,
    mult: b.mult,
  };
  for (const t of tiles) applyTileMaterial(ctx, t, rng);
  // Length lands AFTER materials, matching loop.ts::scoreSubmission (lines ~453-457):
  // multiplicative materials (Glass) scale the suit mult only; length stacks on top
  // of that. Do not move this back above the material loop — Glass ×2 must apply to
  // suitMult alone, not suitMult+length, or scoreWord and submitWord will disagree.
  ctx.mult += wordLengthMult(tiles.length, b.isGibberish);
  submission.settledScore = ctx.chips * ctx.mult;
  return submission;
}
