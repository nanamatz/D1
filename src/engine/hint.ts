/**
 * Per-hand word solver (playtest-01 P2-1, the Magnifier consumable). Scans the
 * curated dictionary and returns up to `max` valid words spellable from the
 * hand's letters (multiset subset), best-scoring first. Duplicate-letter safe.
 * A 20–30k scan per use is trivial — no DAWG needed yet.
 */

import { BALANCE } from './balance';
import type { Lexicon } from './lexicon';
import type { Letter, Tile } from './types';

export interface HintWord {
  word: string;
  /** hand tile ids that spell it (one valid assignment) */
  tileIds: string[];
  /** base score (letter chips × suit multiplier, no jokers) — for ranking */
  score: number;
}

const letterChips = (word: string): number => {
  let sum = 0;
  for (const ch of word) sum += BALANCE.letterChips[ch.toUpperCase()] ?? 0;
  return sum;
};

/** One valid tile assignment for a word from letter→tiles buckets. */
function assign(word: string, byLetter: Map<Letter, Tile[]>): string[] {
  const used = new Map<Letter, number>();
  const ids: string[] = [];
  for (const ch of word) {
    const letter = ch.toUpperCase() as Letter;
    const idx = used.get(letter) ?? 0;
    const tile = byLetter.get(letter)?.[idx];
    if (tile) {
      ids.push(tile.id);
      used.set(letter, idx + 1);
    }
  }
  return ids;
}

export function findSpellableWords(
  hand: readonly Tile[],
  lexicon: Lexicon,
  max = 3,
): HintWord[] {
  const byLetter = new Map<Letter, Tile[]>();
  for (const t of hand) {
    const bucket = byLetter.get(t.letter);
    if (bucket) bucket.push(t);
    else byLetter.set(t.letter, [t]);
  }
  const avail = new Map<Letter, number>();
  for (const [letter, tiles] of byLetter) avail.set(letter, tiles.length);

  const candidates: Array<{ word: string; score: number }> = [];
  const need = new Map<Letter, number>();
  for (const word of lexicon.words()) {
    if (word.length === 0) continue;
    need.clear();
    let ok = true;
    for (const ch of word) {
      const letter = ch.toUpperCase() as Letter;
      const n = (need.get(letter) ?? 0) + 1;
      need.set(letter, n);
      if (n > (avail.get(letter) ?? 0)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const entry = lexicon.lookup(word);
    const mult = entry ? BALANCE.suitMult[entry.suit] : 1;
    candidates.push({ word, score: letterChips(word) * mult });
  }

  candidates.sort(
    (a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word),
  );

  return candidates.slice(0, max).map(({ word, score }) => ({
    word,
    score,
    tileIds: assign(word, byLetter),
  }));
}
