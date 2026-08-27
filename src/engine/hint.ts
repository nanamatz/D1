/**
 * Per-hand word solver (playtest-01 P2-1, the Magnifier consumable). Scans the
 * curated dictionary and returns up to `max` valid words spellable from the
 * hand's letters (multiset subset), best-scoring first. Duplicate-letter safe.
 * A 173k scan per use remains small enough — no DAWG needed yet.
 */

import { BALANCE } from './balance';
import type { Lexicon } from './lexicon';
import { prepareWordSubmission } from './loop';
import { tileBaseChips, wordLengthMult } from './scoring';
import type { BlindState, Letter, RunState, Tile } from './types';

export interface HintWord {
  word: string;
  /** hand tile ids that spell it (one valid assignment) */
  tileIds: string[];
  /** base score (letter chips × (suit multiplier + length bonus), no jokers) — for ranking */
  score: number;
}

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
  context?: { run: RunState; blind: BlindState },
): HintWord[] {
  const spellingTiles = context
    ? (prepareWordSubmission(hand, lexicon, context.run, context.blind).ctx.spellingTiles ?? hand)
    : hand;
  const physicalById = new Map(hand.map((tile) => [tile.id, tile]));
  const byLetter = new Map<Letter, Tile[]>();
  for (const t of spellingTiles) {
    if (t.letter === null) continue; // a Stone tile can spell nothing (GDD §2.2)
    const bucket = byLetter.get(t.letter);
    if (bucket) bucket.push(t);
    else byLetter.set(t.letter, [t]);
  }
  const avail = new Map<Letter, number>();
  for (const [letter, tiles] of byLetter) {
    tiles.sort((a, b) =>
      tileBaseChips(physicalById.get(b.id) ?? b) -
      tileBaseChips(physicalById.get(a.id) ?? a),
    );
    avail.set(letter, tiles.length);
  }

  const candidates: Array<HintWord> = [];
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
    // Only real dictionary words reach here (they came from lexicon.words()), so
    // the length bonus always applies — same rule as the live pipeline (GDD §3.1).
    const mult = (entry ? BALANCE.suitMult[entry.suit] : 1) + wordLengthMult(word.length, false);
    const tileIds = assign(word, byLetter);
    const selected = new Set(tileIds);
    const chips = hand.filter((tile) => selected.has(tile.id)).reduce((sum, tile) => sum + tileBaseChips(tile), 0);
    candidates.push({ word, score: chips * mult, tileIds });
  }

  candidates.sort(
    (a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word),
  );

  return candidates.slice(0, max);
}
