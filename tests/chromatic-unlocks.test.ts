import { describe, it, expect, beforeEach } from 'vitest';
import {
  UNLOCKS,
  loadPlayed,
  isPlayed,
  markPlayed,
  playedCount,
  resetUnlocks,
  activeUnlocks,
  checkWordPlayed,
} from '../src/ui/unlocks';

// jsdom is not configured project-wide; provide a minimal localStorage shim
// (matching tutorial-store.test.ts) so the played-set persistence round-trips.
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null, length: 0,
  } as Storage;
  resetUnlocks();
});

describe('chromatic unlocks — registry (feature-02 C)', () => {
  it('carries the initial table incl. the 4 color words + audio + locale + mascots', () => {
    const ids = new Set(UNLOCKS.map((u) => u.id));
    for (const w of ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND', 'KOREAN', 'ALIEN', 'GHOST', 'DOG', 'CAT', 'TURTLE']) {
      expect(ids.has(w)).toBe(true);
    }
    expect(UNLOCKS.length).toBe(12);
  });

  it('every unlock word is uppercase and equals its id (data-driven, no hard-coded checks)', () => {
    for (const u of UNLOCKS) {
      expect(u.word).toBe(u.word.toUpperCase());
      expect(u.id).toBe(u.word);
    }
  });
});

describe('chromatic unlocks — played persistence', () => {
  it('isPlayed is false until markPlayed, true after (persisted)', () => {
    expect(isPlayed('RED')).toBe(false);
    markPlayed('RED');
    expect(isPlayed('RED')).toBe(true);
    expect(loadPlayed().has('RED')).toBe(true);
  });

  it('markPlayed is idempotent', () => {
    markPlayed('BLUE');
    markPlayed('BLUE');
    expect(playedCount()).toBe(1);
  });
});

describe('chromatic unlocks — checkWordPlayed', () => {
  it('returns the def on first play (case-insensitive), null after / for non-unlock words', () => {
    expect(checkWordPlayed('cat')?.id).toBe('CAT');
    expect(checkWordPlayed('CAT')).toBeNull(); // already played
    expect(checkWordPlayed('banana')).toBeNull(); // not an unlock word
  });
});

describe('chromatic unlocks — activeUnlocks + override', () => {
  it('active = played set normally; the unlock-all override lights everything', () => {
    markPlayed('GREEN');
    expect(activeUnlocks(false)).toEqual(new Set(['GREEN']));
    expect(activeUnlocks(true).size).toBe(UNLOCKS.length);
  });
});
