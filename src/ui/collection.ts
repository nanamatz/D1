/**
 * Word collection tracking (playtest-01 P2-2). Records the first time each word
 * is played, in localStorage, accumulating across sessions. Gibberish is
 * excluded by the caller (it has no dictionary word). The collection *screen*
 * (도감) is a later milestone — this is just the tracking hook.
 */

import { BALANCE } from '../engine/balance';
import { readValue, writeValue } from './storage';

const KEY = 'wj.collection';

/** word (lowercase) → first-played epoch ms. */
export type Collection = Record<string, number>;

export function loadCollection(): Collection {
  return readValue<Collection>(KEY) ?? {};
}

/**
 * Record a played word if new. Returns true if it was newly collected, false if
 * already present. Case-insensitive.
 */
export function recordWord(word: string, now: number = Date.now()): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return false;
  const collection = loadCollection();
  if (collection[w] !== undefined) return false;
  collection[w] = now;
  writeValue(KEY, collection);
  return true;
}

export function collectionSize(): number {
  return Object.keys(loadCollection()).length;
}

export interface CollectionHighlight {
  word: string;
  value: number;
}

export interface CollectionHighlights {
  longest: CollectionHighlight | null;
  toughest: CollectionHighlight | null;
}

/**
 * Derived Collection records: "toughest" means the highest base letter-Chip
 * sum, with length as the tie-break. No new profile data needs to be persisted.
 */
export function collectionHighlights(collection: Collection = loadCollection()): CollectionHighlights {
  let longest: CollectionHighlight | null = null;
  let toughest: CollectionHighlight | null = null;
  for (const word of Object.keys(collection)) {
    const chips = wordChips(word);
    if (
      !longest ||
      word.length > longest.value ||
      (word.length === longest.value && chips > wordChips(longest.word))
    ) {
      longest = { word, value: word.length };
    }
    if (
      !toughest ||
      chips > toughest.value ||
      (chips === toughest.value && word.length > toughest.word.length)
    ) {
      toughest = { word, value: chips };
    }
  }
  return { longest, toughest };
}

function wordChips(word: string): number {
  return [...word.toUpperCase()].reduce(
    (sum, letter) => sum + (BALANCE.letterChips[letter] ?? 0),
    0,
  );
}

const SEEN_KEY = 'wj.collectionSeen';

/** Words collected since the collection was last viewed — drives the `!` badge (spec §0).
 *  Stored as a bare number: valid JSON, so the bytes match the older String(n) form. */
export function unseenCount(): number {
  const seen = readValue<number>(SEEN_KEY) ?? 0;
  return Math.max(0, collectionSize() - (Number.isFinite(seen) ? seen : 0));
}

/** Mark the collection as viewed (clears the badge). */
export function markCollectionSeen(): void {
  writeValue(SEEN_KEY, collectionSize());
}
