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
import type { Tile, WordSubmission } from './types';

/** Spell the tiles as displayed, honoring each tile's case. */
export function spell(tiles: readonly Tile[]): string {
  return tiles
    .map((t) => (t.case === 'lower' ? t.letter.toLowerCase() : t.letter))
    .join('');
}

/** Sum of intrinsic Scrabble letter chips (GDD §2.1). */
export function letterChips(tiles: readonly Tile[]): number {
  let sum = 0;
  for (const t of tiles) sum += BALANCE.letterChips[t.letter] ?? 0;
  return sum;
}

/**
 * Score one submitted tile set into a settled WordSubmission (layer 1).
 * Validity (and thus the gibberish routing) is decided by the lexicon.
 */
export function scoreWord(tiles: readonly Tile[], lexicon: Lexicon): WordSubmission {
  const text = spell(tiles);
  const chips = letterChips(tiles);
  const entry = lexicon.lookup(text);

  if (entry === null) {
    // Gibberish: intrinsic chips × 1.0, no suit/POS, leaves a hole (GDD §6.4).
    return {
      tiles: tiles.slice(),
      text,
      isGibberish: true,
      suit: null,
      posUsed: null,
      settledScore: chips * BALANCE.gibberish.mult,
    };
  }

  // Valid word: chips × register-suit multiplier (GDD §3.1). POS is resolved
  // later by pattern matching (slice ③).
  const mult = BALANCE.suitMult[entry.suit];
  return {
    tiles: tiles.slice(),
    text,
    isGibberish: false,
    suit: entry.suit,
    posUsed: null,
    settledScore: chips * mult,
  };
}
