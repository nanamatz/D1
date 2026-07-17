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
import type { Suit, Tile, WordSubmission } from './types';

/** Sentinel glyph for a letterless Stone tile. Never appears in the lexicon, so a
 *  word containing one always fails lookup → gibberish (GDD §2.2, §6.4). */
export const NO_LETTER = '□';

/** Spell the tiles as displayed, honoring each tile's case. */
export function spell(tiles: readonly Tile[]): string {
  return tiles
    .map((t) => {
      if (t.letter === null) return NO_LETTER;
      return t.case === 'lower' ? t.letter.toLowerCase() : t.letter;
    })
    .join('');
}

/**
 * The letters string fed to `evaluateLetterHand` (GDD §5.5) — the single source
 * of truth for that input, shared by the loop pipeline and the UI stage preview.
 * Letterless (Stone) tiles render as `NO_LETTER` so a stone never silently
 * vanishes from the string (which would corrupt straight/flush detection).
 *
 * Differs from `spell()`: `spell()` honors each tile's upper/lower `case` for
 * lexicon lookup and display; `Letter` is always stored canonically uppercase
 * (see `types.ts`), and `letterString` returns that canonical form as-is — it
 * exists for letter-hand *structure* matching, not for display or lookup.
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
  return {
    tiles: tiles.slice(),
    text: b.text,
    isGibberish: b.isGibberish,
    suit: b.suit,
    posUsed: null,
    settledScore: b.chips * b.mult,
  };
}
