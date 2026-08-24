import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHALLENGE_DEFS,
  CHALLENGE_IDS,
  isChallengeId,
  isChallengeUnlocked,
} from '../src/engine/challenges';
import { newRun } from '../src/engine/run';
import {
  POUCH_IDS,
  pouchDisablesInterest,
  pouchTargetMultiplier,
} from '../src/engine/pouches';
import {
  RECORD_IDS,
  recordDisablesInterest,
  recordRemovesDraftReward,
  recordTargetMultiplier,
} from '../src/engine/records';
import { loadLifetime, recordRunEnd } from '../src/ui/lifetime';
import { resetStorageCache, selectProfile, writeProfileValue } from '../src/ui/storage';

class MemStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
  resetStorageCache();
  selectProfile(1);
});

describe('Challenge registry and run setup', () => {
  it('owns the exact six ordered presets with valid unique references', () => {
    expect(CHALLENGE_DEFS).toEqual([
      { id: 'redPen', pouchId: 'yellow', recordId: 'redLp' },
      { id: 'risingQuota', pouchId: 'green', recordId: 'greenLp' },
      { id: 'narrowDesk', pouchId: 'fiveColor', recordId: 'yellowLp' },
      { id: 'threePasses', pouchId: 'leather', recordId: 'clearLp' },
      { id: 'balancedBurden', pouchId: 'lunchBag', recordId: 'cd' },
      { id: 'randomFinal', pouchId: 'coinPurse', recordId: 'dvd' },
    ]);
    expect(new Set(CHALLENGE_IDS).size).toBe(6);
    expect(CHALLENGE_DEFS.every((def) =>
      POUCH_IDS.includes(def.pouchId) && RECORD_IDS.includes(def.recordId))).toBe(true);
  });

  it('unlocks sequentially while completed entries remain replayable', () => {
    const completed = new Set<typeof CHALLENGE_IDS[number]>();
    expect(CHALLENGE_IDS.map((id) => isChallengeUnlocked(id, completed)))
      .toEqual([true, false, false, false, false, false]);
    completed.add('redPen');
    expect(isChallengeUnlocked('redPen', completed)).toBe(true);
    expect(isChallengeUnlocked('risingQuota', completed)).toBe(true);
    expect(isChallengeUnlocked('narrowDesk', completed)).toBe(false);
  });

  it.each(CHALLENGE_DEFS)('reuses the resolved $id Pouch and Record state', (def) => {
    const challenge = newRun('same-seed', { challengeId: def.id });
    const ordinary = newRun('same-seed', { pouchId: def.pouchId, recordId: def.recordId });
    expect(challenge).toEqual({ ...ordinary, challengeId: def.id });
    expect(newRun('same-seed', { challengeId: def.id })).toEqual(challenge);
  });

  it('resolves the six resource, target, reward, and interest baselines', () => {
    const runs = CHALLENGE_IDS.map((challengeId) => newRun('resolved', { challengeId }));
    expect(runs.map(({ handSize, basePhases, baseDiscards, jokerSlots, gold }) =>
      [handSize, basePhases, baseDiscards, jokerSlots, gold])).toEqual([
      [10, 5, 5, 5, 4],
      [10, 5, 4, 5, 14],
      [10, 5, 3, 4, 4],
      [9, 3, 3, 6, 4],
      [9, 4, 3, 4, 4],
      [9, 4, 3, 4, 4],
    ]);
    expect(runs.every(recordRemovesDraftReward)).toBe(true);
    expect(runs.map((run) => recordDisablesInterest(run) || pouchDisablesInterest(run)))
      .toEqual([false, false, false, false, false, true]);
    expect(runs.map((run) =>
      pouchTargetMultiplier(run) * recordTargetMultiplier(run, 2)))
      .toEqual([1, 1.15, 1.15, 1.15, 2.3, 1.15]);
  });

  it('forces the preset, rejects custom/unknown ids, and clears stale ids for normal runs', () => {
    const run = newRun('challenge', {
      challengeId: 'redPen', pouchId: 'coinPurse', recordId: 'dvd',
    });
    expect(run).toMatchObject({ pouchId: 'yellow', recordId: 'redLp', challengeId: 'redPen' });
    expect(() => newRun('bad', { challengeId: 'redPen', customSeed: true })).toThrow();
    expect(() => newRun('bad', { challengeId: 'retired' as never })).toThrow();
    expect(newRun('normal').challengeId).toBeNull();
    expect(isChallengeId('retired')).toBe(false);
  });
});

describe('Challenge completion and progress isolation', () => {
  const result = (overrides: Record<string, unknown> = {}) => ({
    observationId: 'challenge-result',
    ante: 8,
    gold: 25,
    bestWord: null,
    won: true,
    pouchId: 'yellow' as const,
    recordId: 'redLp' as const,
    customSeed: false,
    challengeId: 'redPen' as const,
    jokerIds: ['bookworm'],
    patternCounts: { simple: 2 },
    ...overrides,
  });

  it('records only an unlocked Chapter 8 win and stays idempotent', () => {
    recordRunEnd(result({ observationId: 'loss', won: false }));
    recordRunEnd(result({ observationId: 'early', ante: 7 }));
    recordRunEnd(result({ observationId: 'locked', challengeId: 'risingQuota' }));
    expect(loadLifetime().completedChallenges).toEqual([]);

    recordRunEnd(result());
    recordRunEnd(result());
    recordRunEnd(result({ observationId: 'second', challengeId: 'risingQuota' }));
    expect(loadLifetime().completedChallenges).toEqual(['redPen', 'risingQuota']);
  });

  it('counts ordinary lifetime progress but excludes standard win rewards and telemetry', () => {
    recordRunEnd(result());
    expect(loadLifetime()).toMatchObject({
      runs: 1,
      wins: 1,
      currentWinStreak: 1,
      patternPlayCounts: { simple: 2 },
      completedChallenges: ['redPen'],
      pouchWins: [],
      recordWins: [],
      recordWinsByPouch: {},
      jokerRecordStickers: {},
      balance: { version: 1, runs: 0, wins: 0, lossesByChapter: {} },
    });
  });

  it('blocks custom-seed and Reveal All completion without fabricating records', () => {
    recordRunEnd(result({ observationId: 'custom', customSeed: true }));
    writeProfileValue('wj.lifetime', 1, {
      ...loadLifetime(),
      challengesDisabled: true,
    });
    recordRunEnd(result({ observationId: 'disabled' }));
    expect(loadLifetime().completedChallenges).toEqual([]);
  });

  it('normalizes a known, deduped, contiguous completion prefix and isolates profiles', () => {
    writeProfileValue('wj.lifetime', 1, {
      completedChallenges: ['risingQuota'],
    });
    expect(loadLifetime(1).completedChallenges).toEqual([]);

    writeProfileValue('wj.lifetime', 1, {
      completedChallenges: ['redPen', 'narrowDesk'],
    });
    expect(loadLifetime(1).completedChallenges).toEqual(['redPen']);

    writeProfileValue('wj.lifetime', 1, {
      completedChallenges: ['risingQuota', 'unknown', 'redPen', 'redPen'],
    });
    expect(loadLifetime(1).completedChallenges).toEqual(['redPen', 'risingQuota']);
    expect(loadLifetime(2).completedChallenges).toEqual([]);
  });
});
