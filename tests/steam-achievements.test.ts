import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  aggregateSteamEligible,
  backfillSteamEligible,
  emptySteamEligible,
  normalizeSteamEligible,
  recordSteamEligibleRun,
} from '../src/ui/steamAchievements';
import { initializeSteamAchievements, loadLifetime, writeLifetime } from '../src/ui/lifetime';
import { resetStorageCache, type SteamOwnershipStatus, type StorageBridge } from '../src/ui/storage';

class MemStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
  delete (globalThis as { wj?: unknown }).wj;
  resetStorageCache();
});

function installLegacyBridge(status: SteamOwnershipStatus) {
  const writes: [string, string][] = [];
  const syncSteam = vi.fn();
  let statusListener: ((status: SteamOwnershipStatus) => void) | undefined;
  const bridge: StorageBridge = {
    snapshot: {
      'wj.lifetime': JSON.stringify({
        balance: { version: 1, runs: 4, wins: 2, lossesByChapter: {} },
        pouchWins: ['yellow'],
        recordWins: ['greenLp'],
        recordWinsByPouch: { yellow: ['greenLp'] },
      }),
    },
    fresh: false,
    steamStatus: status,
    write: (key, value) => writes.push([key, value]),
    remove: () => {},
    syncSteam,
    onSteamStatus: (listener) => { statusListener = listener; },
  };
  (globalThis as { wj?: StorageBridge }).wj = bridge;
  resetStorageCache();
  return {
    writes,
    syncSteam,
    emitStatus: (next: SteamOwnershipStatus) => statusListener?.(next),
  };
}

describe('Steam achievement evidence', () => {
  it.each(['unavailable', 'mismatch', 'pending', 'declined'] as const)(
    'does not persist a missing legacy ledger while ownership is %s',
    (status) => {
      const { writes } = installLegacyBridge(status);
      initializeSteamAchievements();
      expect(writes).toEqual([]);
    },
  );

  it('sends pending positive legacy progress transiently without writing it', () => {
    const { writes, syncSteam } = installLegacyBridge('pending');
    initializeSteamAchievements();
    expect(writes).toEqual([]);
    expect(syncSteam).toHaveBeenCalledWith(expect.objectContaining({
      version: 1, std_runs: 4, std_wins: 2, pouches_won: 1, records_won: 1,
    }));
  });

  it('migrates and resyncs immediately when a positive pending claim becomes eligible', () => {
    const { writes, syncSteam, emitStatus } = installLegacyBridge('pending');
    const unsubscribe = initializeSteamAchievements();
    expect(writes).toEqual([]);
    expect(syncSteam).toHaveBeenCalledTimes(1);

    emitStatus('eligible');
    expect(writes).toHaveLength(1);
    const migrated = JSON.parse(writes[0]![1]).steamEligible;
    expect(migrated).toMatchObject({
      version: 1,
      pouchWins: ['yellow'],
      recordWins: ['greenLp'],
      pouchRecordWins: ['yellow:greenLp'],
    });
    expect(syncSteam).toHaveBeenCalledTimes(2);

    writeLifetime({ ...loadLifetime(), unlockAllApplied: true });
    expect(loadLifetime().steamEligible).toEqual(migrated);
    emitStatus('eligible');
    expect(writes).toHaveLength(2); // migration + the explicit Reveal All-style rewrite
    unsubscribe();
  });

  it('persists the conservative missing-ledger migration when initially eligible', () => {
    const { writes } = installLegacyBridge('eligible');
    initializeSteamAchievements();
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]![1]).steamEligible).toMatchObject({
      version: 1, standardRuns: 4, standardWins: 2, pouchWins: ['yellow'],
    });
  });

  it('syncs only at startup and the semantic run-end checkpoint', () => {
    const source = readFileSync('src/ui/lifetime.ts', 'utf8');
    const writeBody = source.match(/export function writeLifetime[\s\S]*?\n}/)?.[0] ?? '';
    expect(writeBody).not.toContain('syncSteamProgress');
    expect(source).toMatch(/export function initializeSteamAchievements[\s\S]*?syncSteamProgress\(\)/);
    expect(source).toMatch(/writeLifetime\(next\);\s*syncSteamProgress\(\)/);
  });
  it('backfills only conservative legacy provenance once', () => {
    const source = {
      balance: { runs: 4, wins: 2 }, pouchWins: ['yellow'] as const,
      recordWins: ['whiteLp'] as const,
      recordWinsByPouch: { yellow: ['whiteLp'] as const },
      completedChallenges: ['redPen'] as const,
      jokerRecordStickers: { bookworm: 'greenLp' as const },
    };
    expect(backfillSteamEligible(source)).toMatchObject({
      standardRuns: 4, standardWins: 2, pouchWins: ['yellow'],
      recordWins: ['whiteLp'], pouchRecordWins: ['yellow:whiteLp'],
      challengesCompleted: ['redPen'], emojiRecordRanks: { bookworm: 'greenLp' },
    });
    expect(backfillSteamEligible({ ...source, unlockAllApplied: true })).toMatchObject({
      pouchWins: [], recordWins: [], pouchRecordWins: [],
      challengesCompleted: ['redPen'], emojiRecordRanks: { bookworm: 'greenLp' },
    });
    expect(normalizeSteamEligible(emptySteamEligible(), source)).toEqual(emptySteamEligible());
  });

  it('excludes custom runs and records only semantic eligible outcomes', () => {
    const initial = emptySteamEligible();
    expect(recordSteamEligibleRun(initial, { won: true, standard: false }))
      .toEqual(initial);
    const win = recordSteamEligibleRun(initial, {
      won: true, standard: true, pouchId: 'yellow', recordId: 'greenLp',
      jokerIds: ['bookworm', 'bookworm'],
    });
    expect(win).toMatchObject({
      standardRuns: 1, standardWins: 1, pouchWins: ['yellow'],
      recordWins: ['greenLp'], pouchRecordWins: ['yellow:greenLp'],
      emojiRecordRanks: { bookworm: 'greenLp' },
    });
  });

  it('unions three profiles, sums runs, and takes each Emoji maximum rank', () => {
    const one = recordSteamEligibleRun(emptySteamEligible(), {
      won: true, standard: true, pouchId: 'yellow', recordId: 'whiteLp',
      jokerIds: ['bookworm'], challengeId: 'redPen', challengeCompleted: true,
    });
    const two = recordSteamEligibleRun(emptySteamEligible(), {
      won: true, standard: true, pouchId: 'yellow', recordId: 'greenLp',
      jokerIds: ['bookworm', 'redPencil'], challengeId: 'redPen', challengeCompleted: true,
    });
    expect(aggregateSteamEligible([one, two])).toEqual({
      version: 1, std_runs: 2, std_wins: 2, pouches_won: 1, records_won: 2,
      pouch_record_pairs: 2, challenges_completed: 1, emoji_mastered: 2,
      emoji_record_sticker_tiers: 6,
    });
  });

  it('clamps malformed and overflowing counters to Steam int32', () => {
    const payload = aggregateSteamEligible([
      normalizeSteamEligible({ version: 1, standardRuns: Number.MAX_SAFE_INTEGER,
        standardWins: Number.MAX_SAFE_INTEGER }, {}),
    ]);
    expect(payload.std_runs).toBe(2_147_483_647);
    expect(payload.std_wins).toBe(2_147_483_647);
  });
});
