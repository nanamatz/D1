/**
 * Word collection tracking (playtest-01 P2-2). Records the first time each word
 * is played, in localStorage, accumulating across sessions. Gibberish is
 * excluded by the caller (it has no dictionary word). The collection *screen*
 * (도감) is a later milestone — this is just the tracking hook.
 */

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
