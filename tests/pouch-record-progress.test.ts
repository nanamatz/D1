import { beforeEach, describe, expect, it } from 'vitest';
import { isRecordUnlocked } from '../src/engine/records';
import { resetStorageCache, selectProfile } from '../src/ui/storage';
import {
  JOKER_RECORD_STICKER_TOTAL,
  jokerRecordStickerCount,
  loadLifetime,
  mostPlayedPattern,
  recordBestRoundScore,
  recordEndlessEnd,
  recordJokerBlindCounts,
  recordRunEnd,
  recordWinsForPouch,
  writeLifetime,
} from '../src/ui/lifetime';
import { newRunObservationId } from '../src/ui/runObservation';

class MemStorage {
  private store = new Map<string, string>();
  readonly reads = new Map<string, number>();
  getItem(key: string) {
    this.reads.set(key, (this.reads.get(key) ?? 0) + 1);
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  resetReads() { this.reads.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
  delete (globalThis as { wj?: unknown }).wj;
  resetStorageCache();
});

describe('pouch and Record profile progress', () => {
  it('never adds Steam evidence after Reveal All, including a continued standard win', () => {
    (globalThis as unknown as { wj: unknown }).wj = {
      snapshot: {}, fresh: false, steamStatus: 'eligible',
      write: () => {}, remove: () => {}, syncSteam: () => {},
    };
    resetStorageCache();
    const result = {
      observationId: 'continued-standard-win',
      ante: 8,
      gold: 20,
      bestWord: null,
      won: true,
      pouchId: 'yellow' as const,
      recordId: 'greenLp' as const,
      customSeed: false,
      jokerIds: ['bookworm'],
    };
    recordRunEnd(result);
    expect(loadLifetime(1).steamEligible).toMatchObject({
      standardRuns: 1,
      standardWins: 1,
      pouchWins: ['yellow'],
      recordWins: ['greenLp'],
      pouchRecordWins: ['yellow:greenLp'],
      emojiRecordRanks: { bookworm: 'greenLp' },
    });

    selectProfile(2);
    writeLifetime({
      ...loadLifetime(2),
      profileCreated: true,
      unlockAllApplied: true,
      challengesDisabled: true,
    }, 2);
    const before = loadLifetime(2).steamEligible;
    recordRunEnd({ ...result, observationId: 'continued-after-reveal' });
    expect(loadLifetime(2).steamEligible).toEqual(before);
  });

  it('keeps every profile Steam ledger unchanged in a mismatched session', () => {
    let syncs = 0;
    (globalThis as unknown as { wj: unknown }).wj = {
      snapshot: {}, fresh: false, steamStatus: 'mismatch',
      write: () => {}, remove: () => {}, syncSteam: () => { syncs += 1; },
    };
    resetStorageCache();
    const before = [1, 2, 3].map((slot) => loadLifetime(slot as 1 | 2 | 3).steamEligible);
    recordRunEnd({
      observationId: 'mismatch-standard-win', ante: 8, gold: 20,
      bestWord: null, won: true, pouchId: 'yellow', recordId: 'greenLp',
      jokerIds: ['bookworm'],
    });
    expect([1, 2, 3].map((slot) => loadLifetime(slot as 1 | 2 | 3).steamEligible))
      .toEqual(before);
    expect(syncs).toBe(0);
  });

  it('keeps the highest finalized round score for the active profile', () => {
    recordBestRoundScore(12_345);
    recordBestRoundScore(9_999);
    expect(loadLifetime().bestRoundScore).toBe(12_345);
  });

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
    expect(loadLifetime().recordWinsByPouch).toEqual({ yellow: ['whiteLp'] });
    expect(loadLifetime().wins).toBe(2);
    expect(loadLifetime().balance).toEqual({
      version: 1,
      runs: 2,
      wins: 2,
      lossesByChapter: {},
    });
  });

  it('keeps each owned Emoji Tile\'s highest cleared Record sticker', () => {
    recordRunEnd({
      ante: 8,
      gold: 20,
      bestWord: null,
      won: true,
      recordId: 'whiteLp',
      jokerIds: ['bookworm', 'bookworm', 'notAProductionJoker'],
    });
    recordRunEnd({
      ante: 8,
      gold: 30,
      bestWord: null,
      won: true,
      recordId: 'greenLp',
      jokerIds: ['bookworm', 'alliterationSticker'],
    });
    recordRunEnd({
      ante: 8,
      gold: 40,
      bestWord: null,
      won: true,
      recordId: 'redLp',
      jokerIds: ['bookworm'],
    });

    const lifetime = loadLifetime();
    expect(lifetime.jokerRecordStickers).toEqual({
      bookworm: 'greenLp',
      alliterationSticker: 'greenLp',
    });
    expect(jokerRecordStickerCount(lifetime)).toBe(6);
    expect(JOKER_RECORD_STICKER_TOTAL).toBe(1_200);
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
      jokerIds: ['bookworm'],
    });
    recordRunEnd({
      ante: 8,
      gold: 99,
      bestWord: null,
      won: true,
      pouchId: 'blue',
      recordId: 'redLp',
      customSeed: true,
      jokerIds: ['alliterationSticker'],
    });
    expect(loadLifetime().pouchWins).toEqual([]);
    expect(loadLifetime().recordWins).toEqual([]);
    expect(loadLifetime().recordWinsByPouch).toEqual({});
    expect(loadLifetime().jokerRecordStickers).toEqual({});
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
      recordWinsByPouch: {},
      jokerRecordStickers: {},
      patternPlayCounts: {},
      jokerBlindsCompleted: {},
      currentWinStreak: 0,
      bestWinStreak: 0,
      lastRunObservation: null,
      equippedRegisterTitle: null,
      balance: { version: 1, runs: 0, wins: 0, lossesByChapter: {} },
    });
  });

  it('records a completed run once across reload effects and separates repeated seeds by observation id', () => {
    const firstId = newRunObservationId();
    const secondId = newRunObservationId();
    expect(secondId).not.toBe(firstId);
    const result = {
      observationId: firstId, ante: 3, gold: 4, bestWord: null, won: false,
      patternCounts: { simple: 2 },
    } as const;
    recordRunEnd(result);
    recordRunEnd(result);
    recordRunEnd({ ...result, observationId: secondId });
    expect(loadLifetime()).toMatchObject({
      runs: 2,
      wins: 0,
      patternPlayCounts: { simple: 4 },
      lastRunObservation: { id: secondId, runEndRecorded: true },
    });
  });

  it('keeps a durable Chapter 8 pattern baseline through Endless reload/loss', () => {
    const observationId = newRunObservationId();
    const win = {
      observationId, ante: 8, gold: 10, bestWord: null, won: true,
      patternCounts: { simple: 2, complex: 1 },
    } as const;
    recordRunEnd(win);
    recordRunEnd(win); // reloaded Chapter 8 Game Over
    recordEndlessEnd({
      observationId, ante: 10, bestScore: 500,
      patternCounts: { simple: 3, complex: 2 },
    });
    recordEndlessEnd({
      observationId, ante: 10, bestScore: 500,
      patternCounts: { simple: 3, complex: 2 },
    }); // reloaded Endless loss
    expect(loadLifetime()).toMatchObject({
      runs: 1,
      wins: 1,
      patternPlayCounts: { simple: 3, complex: 2 },
      lastRunObservation: {
        id: observationId,
        runEndRecorded: true,
        patternBaseline: { simple: 3, complex: 2 },
      },
    });
  });

  it('does not scan the word collection in finalized-blind hot mutations', () => {
    const storage = localStorage as unknown as MemStorage;
    localStorage.setItem('wj.lifetime', JSON.stringify({ bestWord: 'quiz', bestWordScore: 66 }));
    localStorage.setItem('wj.collection', JSON.stringify(Object.fromEntries(
      Array.from({ length: 5_000 }, (_, index) => [`word${index}`, Date.now()]),
    )));
    storage.resetReads();
    recordBestRoundScore(123);
    recordJokerBlindCounts('hot-path', { bookworm: 1 });
    expect(storage.reads.get('wj.collection') ?? 0).toBe(0);
    const raw = JSON.parse(localStorage.getItem('wj.lifetime')!);
    const lifetime = raw.__wjProfileSlots ? raw.slots['1'] : raw;
    expect(lifetime).toMatchObject({ bestWord: 'quiz', bestWordScore: 66 });
  });

  it('aggregates display stats for custom seeds, resets streaks, and uses rank ties', () => {
    recordRunEnd({
      ante: 8, gold: 0, bestWord: null, won: true, customSeed: true,
      patternCounts: { simple: 2, complex: 2 },
    });
    recordRunEnd({
      ante: 2, gold: 0, bestWord: null, won: true,
      patternCounts: { simple: 1 },
    });
    recordJokerBlindCounts('display-one', { bookworm: 3, notAProductionJoker: 9 });
    recordJokerBlindCounts('display-two', { bookworm: 1 });
    let lifetime = loadLifetime();
    expect(lifetime).toMatchObject({
      wins: 2,
      currentWinStreak: 2,
      bestWinStreak: 2,
      patternPlayCounts: { simple: 3, complex: 2 },
      jokerBlindsCompleted: { bookworm: 4 },
    });
    expect(mostPlayedPattern({ simple: 2, complex: 2 })).toEqual({ id: 'complex', count: 2 });

    recordRunEnd({ ante: 3, gold: 0, bestWord: null, won: false });
    lifetime = loadLifetime();
    expect(lifetime.currentWinStreak).toBe(0);
    expect(lifetime.bestWinStreak).toBe(2);
  });

  it('durably reconciles cumulative Emoji counts across retries, stale saves, and new runs', () => {
    recordJokerBlindCounts('run-a', { bookworm: 1 });
    recordJokerBlindCounts('run-a', { bookworm: 2 }); // run.json ahead: recover +1
    recordJokerBlindCounts('run-a', { bookworm: 2 }); // StrictMode/reload retry
    recordJokerBlindCounts('run-a', { bookworm: 1 }); // stale run: no rollback
    recordJokerBlindCounts('run-a', { bookworm: 3 }); // catch up only +1
    expect(loadLifetime()).toMatchObject({
      jokerBlindsCompleted: { bookworm: 3 },
      lastRunObservation: { id: 'run-a', jokerBaseline: { bookworm: 3 } },
    });

    recordJokerBlindCounts('run-b', { bookworm: 1 }); // new run baseline resets
    expect(loadLifetime()).toMatchObject({
      jokerBlindsCompleted: { bookworm: 4 },
      lastRunObservation: { id: 'run-b', jokerBaseline: { bookworm: 1 } },
    });
  });

  it('keeps completed-blind Emoji Tile counts isolated by profile', () => {
    selectProfile(1);
    recordJokerBlindCounts('profile-one', { bookworm: 2 });
    recordRunEnd({ observationId: 'profile-one', ante: 1, gold: 0, bestWord: null, won: false });
    selectProfile(2);
    recordJokerBlindCounts('profile-two', { alliterationSticker: 1 });
    recordRunEnd({ observationId: 'profile-two', ante: 1, gold: 0, bestWord: null, won: false });
    expect(loadLifetime(1).jokerBlindsCompleted).toEqual({ bookworm: 2 });
    expect(loadLifetime(2).jokerBlindsCompleted).toEqual({ alliterationSticker: 1 });
    expect(loadLifetime(1).lastRunObservation?.id).toBe('profile-one');
    expect(loadLifetime(2).lastRunObservation?.id).toBe('profile-two');
  });

  it('normalizes equipped profile-title ids without depending on translated names', () => {
    localStorage.setItem('wj.lifetime', JSON.stringify({
      equippedRegisterTitle: 'formal.professor',
    }));
    expect(loadLifetime().equippedRegisterTitle).toBe('formal.professor');

    localStorage.setItem('wj.lifetime', JSON.stringify({ equippedRegisterTitle: 'formal.unknown' }));
    expect(loadLifetime().equippedRegisterTitle).toBeNull();
    localStorage.setItem('wj.lifetime', JSON.stringify({ equippedRegisterTitle: 7 }));
    expect(loadLifetime().equippedRegisterTitle).toBeNull();
  });

  it('keeps the Record ladder independent for every pouch', () => {
    recordRunEnd({
      ante: 8,
      gold: 20,
      bestWord: null,
      won: true,
      pouchId: 'yellow',
      recordId: 'whiteLp',
      customSeed: false,
    });

    const lifetime = loadLifetime();
    const yellowWins = recordWinsForPouch(lifetime, 'yellow');
    const blueWins = recordWinsForPouch(lifetime, 'blue');
    expect([...yellowWins]).toEqual(['whiteLp']);
    expect([...blueWins]).toEqual([]);
    expect(isRecordUnlocked('redLp', yellowWins)).toBe(true);
    expect(isRecordUnlocked('redLp', blueWins)).toBe(false);
  });

  it('migrates legacy global Record wins to Yellow Pouch only', () => {
    localStorage.setItem('wj.lifetime', JSON.stringify({
      recordWins: ['whiteLp', 'redLp'],
    }));

    const lifetime = loadLifetime();
    expect([...recordWinsForPouch(lifetime, 'yellow')]).toEqual(['whiteLp', 'redLp']);
    expect([...recordWinsForPouch(lifetime, 'blue')]).toEqual([]);
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

  it('drops stale Emoji Tile ids and invalid Record stickers from storage', () => {
    localStorage.setItem('wj.lifetime', JSON.stringify({
      jokerRecordStickers: {
        bookworm: 'dvd',
        retiredTile: 'dvd',
        alliterationSticker: 'cassette',
      },
    }));

    expect(loadLifetime().jokerRecordStickers).toEqual({ bookworm: 'dvd' });
  });
});
