import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  aggregateSteamEligible,
  backfillSteamEligible,
  emptySteamEligible,
  normalizeSteamEligible,
  recordSteamEligibleRun,
} from '../src/ui/steamAchievements';

describe('Steam achievement evidence', () => {
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
