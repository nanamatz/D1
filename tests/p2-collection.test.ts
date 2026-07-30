import { describe, it, expect, beforeEach } from 'vitest';
import {
  collectionHighlights,
  collectionSize,
  loadCollection,
  recordWord,
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
    expect(recordWord('cat', 12, 1000)).toBe(true);
    expect(loadCollection().cat).toEqual({
      firstPlayedAt: 1000,
      plays: 1,
      bestScore: 12,
    });
  });

  it('counts repeat plays, keeps the best score and first timestamp', () => {
    expect(recordWord('cat', 12, 1000)).toBe(true);
    expect(recordWord('cat', 8, 2000)).toBe(false);
    expect(recordWord('CAT', 20, 3000)).toBe(false);
    expect(loadCollection().cat).toEqual({
      firstPlayedAt: 1000,
      plays: 3,
      bestScore: 20,
    });
  });

  it('accumulates distinct words across a session', () => {
    recordWord('cat');
    recordWord('run');
    recordWord('pizza');
    expect(collectionSize()).toBe(3);
  });

  it('persists across a reload (same storage → loadCollection sees prior writes)', () => {
    recordWord('gem', 15, 500);
    // simulate a fresh read (as a later session would)
    expect(loadCollection().gem).toEqual({
      firstPlayedAt: 500,
      plays: 1,
      bestScore: 15,
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
      bestScore: 0,
    });
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
});
