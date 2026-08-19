/**
 * Profile-scoped word collection and lifetime play stats. Gibberish is excluded
 * by the caller because it has no dictionary entry.
 */

import {
  activeProfile,
  readProfileValue,
  readValue,
  writeValue,
  type ProfileSlot,
} from './storage';
import { wordLetterChips } from '../engine/scoring';

const KEY = 'wj.collection';

export interface WordCollectionEntry {
  firstPlayedAt: number;
  plays: number;
  bestScore: number;
}

/** word (lowercase) → lifetime profile stats. */
export type Collection = Record<string, WordCollectionEntry>;

export const WORD_STATS_PAGE_SIZE = 50;

export function sortedCollectionStats(collection: Collection): [string, WordCollectionEntry][] {
  return Object.entries(collection)
    .sort((a, b) => b[1].plays - a[1].plays || a[0].localeCompare(b[0]));
}

export function collectionStatsPage(
  sorted: readonly [string, WordCollectionEntry][],
  page: number,
  pageSize = WORD_STATS_PAGE_SIZE,
): { entries: [string, WordCollectionEntry][]; page: number; pages: number } {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const safePage = Math.min(pages - 1, Math.max(0, Math.floor(page)));
  return { entries: sorted.slice(safePage * size, (safePage + 1) * size), page: safePage, pages };
}

export function loadCollection(slot: ProfileSlot = activeProfile()): Collection {
  const stored = readProfileValue<Record<string, unknown>>(KEY, slot);
  if (!stored || typeof stored !== 'object') return {};

  const collection: Collection = {};
  for (const [word, value] of Object.entries(stored)) {
    const entry = normalizeEntry(value, word);
    if (entry) collection[word] = entry;
  }
  return collection;
}

/**
 * Record a valid word play. Returns true only when it is newly discovered.
 * Score is the word's intrinsic letter-chip sum; all enhancements and Mult are excluded.
 */
export function recordWord(word: string, now: number = Date.now()): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return false;
  const score = wordLetterChips(w);
  const collection = loadCollection();
  const previous = collection[w];
  collection[w] = previous
    ? {
        ...previous,
        plays: previous.plays + 1,
        bestScore: Math.max(previous.bestScore, score),
      }
    : {
        firstPlayedAt: now,
        plays: 1,
        bestScore: score,
      };
  writeValue(KEY, collection);
  return previous === undefined;
}

export function collectionSize(slot: ProfileSlot = activeProfile()): number {
  return Object.keys(loadCollection(slot)).length;
}

export interface CollectionHighlight {
  word: string;
  value: number;
}

export interface CollectionHighlights {
  highestScore: CollectionHighlight | null;
  longest: CollectionHighlight | null;
  mostPlayed: CollectionHighlight | null;
}

export function collectionHighlights(collection: Collection = loadCollection()): CollectionHighlights {
  let highestScore: CollectionHighlight | null = null;
  let longest: CollectionHighlight | null = null;
  let mostPlayed: CollectionHighlight | null = null;
  for (const [word, entry] of Object.entries(collection)) {
    if (
      !highestScore ||
      entry.bestScore > highestScore.value ||
      (entry.bestScore === highestScore.value && word.length > highestScore.word.length)
    ) {
      highestScore = { word, value: entry.bestScore };
    }
    if (
      !longest ||
      word.length > longest.value ||
      (word.length === longest.value && entry.bestScore > collection[longest.word]!.bestScore)
    ) {
      longest = { word, value: word.length };
    }
    if (
      !mostPlayed ||
      entry.plays > mostPlayed.value ||
      (entry.plays === mostPlayed.value &&
        entry.bestScore > collection[mostPlayed.word]!.bestScore)
    ) {
      mostPlayed = { word, value: entry.plays };
    }
  }
  return { highestScore, longest, mostPlayed };
}

function normalizeEntry(value: unknown, word: string): WordCollectionEntry | null {
  const bestScore = wordLetterChips(word);
  // Pre-stat schema: the value was the first-played timestamp.
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { firstPlayedAt: value, plays: 1, bestScore };
  }
  if (!value || typeof value !== 'object') return null;

  const raw = value as Partial<WordCollectionEntry>;
  return {
    firstPlayedAt:
      typeof raw.firstPlayedAt === 'number' && Number.isFinite(raw.firstPlayedAt)
        ? raw.firstPlayedAt
        : 0,
    plays:
      typeof raw.plays === 'number' && Number.isFinite(raw.plays)
        ? Math.max(1, Math.floor(raw.plays))
        : 1,
    // Recompute old settled-score records so existing profiles migrate immediately.
    bestScore,
  };
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
