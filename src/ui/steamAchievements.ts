import { CHALLENGE_IDS } from '../engine/challenges';
import { ALL_JOKERS } from '../engine/jokers';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import type { ChallengeId, PouchId, RecordId } from '../engine/types';

export const STEAM_STAT_NAMES = [
  'std_runs', 'std_wins', 'pouches_won', 'records_won',
  'pouch_record_pairs', 'challenges_completed', 'emoji_mastered',
  'emoji_record_sticker_tiers',
] as const;
export type SteamStatName = (typeof STEAM_STAT_NAMES)[number];
export type SteamStatPayload = { version: 1 } & Record<SteamStatName, number>;

export interface SteamEligibleV1 {
  version: 1;
  standardRuns: number;
  standardWins: number;
  pouchWins: PouchId[];
  recordWins: RecordId[];
  pouchRecordWins: `${PouchId}:${RecordId}`[];
  challengesCompleted: ChallengeId[];
  emojiRecordRanks: Partial<Record<string, RecordId>>;
}

export interface SteamBackfillSource {
  unlockAllApplied?: boolean;
  balance?: { runs?: number; wins?: number };
  pouchWins?: readonly PouchId[];
  recordWins?: readonly RecordId[];
  recordWinsByPouch?: Partial<Record<PouchId, readonly RecordId[]>>;
  completedChallenges?: readonly ChallengeId[];
  jokerRecordStickers?: Partial<Record<string, RecordId>>;
}

const INT32_MAX = 2_147_483_647;
const jokerIds = new Set(ALL_JOKERS.map((def) => def.id));
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(INT32_MAX, Math.floor(value)) : 0;
const pouches = (value: unknown): PouchId[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is PouchId => POUCH_IDS.includes(id as PouchId)))] : [];
const records = (value: unknown): RecordId[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is RecordId => RECORD_IDS.includes(id as RecordId)))] : [];
const challenges = (value: unknown): ChallengeId[] => Array.isArray(value)
  ? CHALLENGE_IDS.filter((id) => value.includes(id)) : [];
const emojiRanks = (value: unknown): Partial<Record<string, RecordId>> =>
  !value || typeof value !== 'object' || Array.isArray(value) ? {} : Object.fromEntries(
    Object.entries(value).filter(([id, rank]) =>
      jokerIds.has(id) && RECORD_IDS.includes(rank as RecordId)),
  );
const pairs = (value: unknown): `${PouchId}:${RecordId}`[] => Array.isArray(value)
  ? [...new Set(value.filter((pair): pair is `${PouchId}:${RecordId}` => {
      if (typeof pair !== 'string') return false;
      const [pouch, record, extra] = pair.split(':');
      return extra === undefined && POUCH_IDS.includes(pouch as PouchId) &&
        RECORD_IDS.includes(record as RecordId);
    }))] : [];

export const emptySteamEligible = (): SteamEligibleV1 => ({
  version: 1, standardRuns: 0, standardWins: 0, pouchWins: [], recordWins: [],
  pouchRecordWins: [], challengesCompleted: [], emojiRecordRanks: {},
});

export function backfillSteamEligible(source: SteamBackfillSource): SteamEligibleV1 {
  const allowUnlockBackfill = source.unlockAllApplied !== true;
  const pouchRecordWins: `${PouchId}:${RecordId}`[] = [];
  if (allowUnlockBackfill) {
    for (const pouch of POUCH_IDS) {
      for (const record of records(source.recordWinsByPouch?.[pouch])) {
        pouchRecordWins.push(`${pouch}:${record}`);
      }
    }
  }
  return {
    version: 1,
    standardRuns: count(source.balance?.runs),
    standardWins: count(source.balance?.wins),
    pouchWins: allowUnlockBackfill ? pouches(source.pouchWins) : [],
    recordWins: allowUnlockBackfill ? records(source.recordWins) : [],
    pouchRecordWins,
    challengesCompleted: challenges(source.completedChallenges),
    emojiRecordRanks: emojiRanks(source.jokerRecordStickers),
  };
}

export function normalizeSteamEligible(
  value: unknown,
  source: SteamBackfillSource,
): SteamEligibleV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (value as { version?: unknown }).version !== 1) return backfillSteamEligible(source);
  const raw = value as Partial<SteamEligibleV1>;
  const standardRuns = count(raw.standardRuns);
  return {
    version: 1,
    standardRuns,
    standardWins: Math.min(standardRuns, count(raw.standardWins)),
    pouchWins: pouches(raw.pouchWins),
    recordWins: records(raw.recordWins),
    pouchRecordWins: pairs(raw.pouchRecordWins),
    challengesCompleted: challenges(raw.challengesCompleted),
    emojiRecordRanks: emojiRanks(raw.emojiRecordRanks),
  };
}

export function recordSteamEligibleRun(
  ledger: SteamEligibleV1,
  result: {
    won: boolean; standard: boolean; challengeId?: ChallengeId | null;
    challengeCompleted?: boolean; pouchId?: PouchId; recordId?: RecordId;
    jokerIds?: readonly string[];
  },
): SteamEligibleV1 {
  const next = normalizeSteamEligible(ledger, {});
  if (result.standard) {
    next.standardRuns = count(next.standardRuns + 1);
    if (result.won) {
      next.standardWins = count(next.standardWins + 1);
      if (result.pouchId) next.pouchWins = pouches([...next.pouchWins, result.pouchId]);
      if (result.recordId) next.recordWins = records([...next.recordWins, result.recordId]);
      if (result.pouchId && result.recordId) {
        next.pouchRecordWins = pairs([
          ...next.pouchRecordWins, `${result.pouchId}:${result.recordId}`,
        ]);
      }
      if (result.recordId) {
        const rank = RECORD_IDS.indexOf(result.recordId);
        for (const id of new Set(result.jokerIds ?? [])) {
          if (!jokerIds.has(id)) continue;
          const old = next.emojiRecordRanks[id];
          if (!old || rank > RECORD_IDS.indexOf(old)) next.emojiRecordRanks[id] = result.recordId;
        }
      }
    }
  }
  if (result.challengeCompleted && result.challengeId) {
    next.challengesCompleted = challenges([...next.challengesCompleted, result.challengeId]);
  }
  return next;
}

export function aggregateSteamEligible(ledgers: readonly SteamEligibleV1[]): SteamStatPayload {
  const pouchWins = new Set<PouchId>();
  const recordWins = new Set<RecordId>();
  const pairWins = new Set<string>();
  const challengeWins = new Set<ChallengeId>();
  const bestEmojiRanks = new Map<string, number>();
  let standardRuns = 0;
  let standardWins = 0;
  for (const ledger of ledgers) {
    const normalized = normalizeSteamEligible(ledger, {});
    standardRuns = count(standardRuns + normalized.standardRuns);
    standardWins = count(standardWins + normalized.standardWins);
    normalized.pouchWins.forEach((id) => pouchWins.add(id));
    normalized.recordWins.forEach((id) => recordWins.add(id));
    normalized.pouchRecordWins.forEach((id) => pairWins.add(id));
    normalized.challengesCompleted.forEach((id) => challengeWins.add(id));
    for (const [id, record] of Object.entries(normalized.emojiRecordRanks)) {
      if (!record) continue;
      bestEmojiRanks.set(id, Math.max(bestEmojiRanks.get(id) ?? 0, RECORD_IDS.indexOf(record) + 1));
    }
  }
  return {
    version: 1,
    std_runs: standardRuns,
    std_wins: standardWins,
    pouches_won: pouchWins.size,
    records_won: recordWins.size,
    pouch_record_pairs: pairWins.size,
    challenges_completed: challengeWins.size,
    emoji_mastered: bestEmojiRanks.size,
    emoji_record_sticker_tiers: count([...bestEmojiRanks.values()].reduce((sum, n) => sum + n, 0)),
  };
}
