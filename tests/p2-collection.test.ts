import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectionEntry,
  collectionHighlights,
  collectionStatsPage,
  collectionSize,
  loadCollection,
  recordWord,
  sortedCollectionStats,
} from '../src/ui/collection';

class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  key() {
    return null;
  }
  get length() {
    return this.store.size;
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage();
});

describe('P2-2 — word collection tracking', () => {
  it('records a newly played word with score and timestamp', () => {
    expect(recordWord('cat', 1000)).toBe(true);
    expect(loadCollection().cat).toEqual({
      firstPlayedAt: 1000,
      plays: 1,
      bestScore: 15,
    });
  });

  it('counts repeat plays, keeps the best score and first timestamp', () => {
    expect(recordWord('cat', 1000)).toBe(true);
    expect(recordWord('cat', 2000)).toBe(false);
    expect(recordWord('CAT', 3000)).toBe(false);
    expect(loadCollection().cat).toEqual({
      firstPlayedAt: 1000,
      plays: 3,
      bestScore: 15,
    });
  });

  it('treats Object prototype names as ordinary discoverable words', () => {
    expect(collectionEntry(loadCollection(), 'constructor')).toBeUndefined();
    expect(recordWord('constructor', 1000)).toBe(true);
    expect(collectionEntry(loadCollection(), 'constructor')).toEqual({
      firstPlayedAt: 1000,
      plays: 1,
      bestScore: 45,
    });
    expect(recordWord('constructor', 2000)).toBe(false);
    expect(collectionEntry(loadCollection(), 'constructor')?.plays).toBe(2);
  });

  it('accumulates distinct words across a session', () => {
    recordWord('cat');
    recordWord('run');
    recordWord('pizza');
    expect(collectionSize()).toBe(3);
  });

  it('persists across a reload (same storage → loadCollection sees prior writes)', () => {
    recordWord('gem', 500);
    // simulate a fresh read (as a later session would)
    expect(loadCollection().gem).toEqual({
      firstPlayedAt: 500,
      plays: 1,
      bestScore: 18,
    });
  });

  it('ignores blank input', () => {
    expect(recordWord('   ')).toBe(false);
    expect(collectionSize()).toBe(0);
  });

  it('migrates legacy first-play timestamps without losing discoveries', () => {
    localStorage.setItem('wj.collection', JSON.stringify({ cat: 500 }));
    expect(loadCollection().cat).toEqual({
      firstPlayedAt: 500,
      plays: 1,
      bestScore: 15,
    });
  });

  it('recomputes old settled scores from intrinsic letter chips', () => {
    localStorage.setItem('wj.collection', JSON.stringify({
      cat: { firstPlayedAt: 500, plays: 2, bestScore: 9999 },
    }));
    expect(loadCollection().cat!.bestScore).toBe(15);
  });

  it('derives highest-score, longest and most-played records', () => {
    const highlights = collectionHighlights({
      alphabet: { firstPlayedAt: 1, plays: 2, bestScore: 40 },
      quiz: { firstPlayedAt: 2, plays: 7, bestScore: 30 },
      pizza: { firstPlayedAt: 3, plays: 3, bestScore: 90 },
    });
    expect(highlights.highestScore).toEqual({ word: 'pizza', value: 90 });
    expect(highlights.longest).toEqual({ word: 'alphabet', value: 8 });
    expect(highlights.mostPlayed).toEqual({ word: 'quiz', value: 7 });
  });

  it('sorts a large stats snapshot once and renders a bounded, clamped page', () => {
    const collection = Object.fromEntries(Array.from({ length: 5_000 }, (_, index) => [
      `word${String(index).padStart(4, '0')}`,
      { firstPlayedAt: index, plays: index % 17, bestScore: index % 31 },
    ]));
    const sorted = sortedCollectionStats(collection);
    const first = collectionStatsPage(sorted, 0);
    const last = collectionStatsPage(sorted, 999_999);
    expect(first.entries).toHaveLength(50);
    expect(first.entries[0]![1].plays).toBeGreaterThanOrEqual(first.entries[49]![1].plays);
    expect(last.page).toBe(last.pages - 1);
    expect(last.entries.length).toBeLessThanOrEqual(50);
  });
});
