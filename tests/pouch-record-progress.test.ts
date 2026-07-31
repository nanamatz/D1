import { beforeEach, describe, expect, it } from 'vitest';
import { loadLifetime, recordRunEnd } from '../src/ui/lifetime';

class MemStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
});

describe('pouch and Record profile progress', () => {
  it('records an unseeded win once in the existing lifetime profile', () => {
    recordRunEnd({
      ante: 8,
      gold: 20,
      bestWord: null,
      won: true,
      pouchId: 'yellow',
      recordId: 'whiteLp',
      customSeed: false,
    });
    recordRunEnd({
      ante: 8,
      gold: 30,
      bestWord: null,
      won: true,
      pouchId: 'yellow',
      recordId: 'whiteLp',
      customSeed: false,
    });
    expect(loadLifetime().pouchWins).toEqual(['yellow']);
    expect(loadLifetime().recordWins).toEqual(['whiteLp']);
    expect(loadLifetime().wins).toBe(2);
    expect(loadLifetime().balance).toEqual({
      version: 1,
      runs: 2,
      wins: 2,
      lossesByChapter: {},
    });
  });

  it('does not grant unlock progress for losses or custom-seed wins', () => {
    recordRunEnd({
      ante: 3,
      gold: 5,
      bestWord: null,
      won: false,
      pouchId: 'blue',
      recordId: 'redLp',
      customSeed: false,
    });
    recordRunEnd({
      ante: 8,
      gold: 99,
      bestWord: null,
      won: true,
      pouchId: 'blue',
      recordId: 'redLp',
      customSeed: true,
    });
    expect(loadLifetime().pouchWins).toEqual([]);
    expect(loadLifetime().recordWins).toEqual([]);
    expect(loadLifetime().wins).toBe(1);
    expect(loadLifetime().balance).toEqual({
      version: 1,
      runs: 1,
      wins: 0,
      lossesByChapter: { '3': 1 },
    });
  });

  it('loads legacy lifetime data with empty progress arrays', () => {
    localStorage.setItem('wj.lifetime', JSON.stringify({ runs: 4, mostGold: 12 }));
    expect(loadLifetime()).toMatchObject({
      runs: 4,
      wins: 0,
      mostGold: 12,
      pouchWins: [],
      recordWins: [],
      balance: { version: 1, runs: 0, wins: 0, lossesByChapter: {} },
    });
  });

  it('recomputes a legacy best-word score from intrinsic letter chips', () => {
    localStorage.setItem('wj.lifetime', JSON.stringify({
      bestWord: 'quiz',
      bestWordScore: 9999,
    }));
    expect(loadLifetime()).toMatchObject({ bestWord: 'quiz', bestWordScore: 66 });
  });

  it('normalizes malformed balance telemetry from storage', () => {
    localStorage.setItem('wj.lifetime', JSON.stringify({
      balance: {
        runs: 2.8,
        wins: 8,
        lossesByChapter: { '2': 3.9, '39': 2, nope: 4 },
      },
    }));
    expect(loadLifetime().balance).toEqual({
      version: 1,
      runs: 2,
      wins: 2,
      lossesByChapter: { '2': 3 },
    });
  });
});
