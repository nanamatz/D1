/**
 * Demo-only word finder shared by src/sim scenarios (autoplay.ts, materials.ts).
 * Extracted so importing it never triggers autoplay.ts's top-level `main()` call
 * (autoplay.ts is a CLI entry point that runs its demo unconditionally on import).
 *
 * Finds any valid word spellable from a hand (ordered, length ≤ maxLen).
 */

import type { Lexicon } from '../engine/lexicon';
import type { Tile } from '../engine/types';

export function findWord(hand: readonly Tile[], lex: Lexicon, maxLen = 4): Tile[] | null {
  // Stone tiles (letter: null) can never be part of a valid word — a "word"
  // containing one is gibberish by definition (GDD §6.4). Exclude them from
  // the search space entirely rather than routing the string through
  // NO_LETTER: findWord's whole purpose is finding VALID words, so a
  // candidate that can provably never match shouldn't be a search branch.
  const spellable = hand.filter((t) => t.letter !== null);
  const search = (prefix: Tile[], rest: Tile[]): Tile[] | null => {
    if (prefix.length >= 1 && lex.isWord(prefix.map((t) => t.letter).join(''))) return prefix;
    if (prefix.length >= maxLen) return null;
    for (let i = 0; i < rest.length; i++) {
      const next = search([...prefix, rest[i]!], [...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (next) return next;
    }
    return null;
  };
  return search([], spellable);
}
