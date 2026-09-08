import { CHALLENGE_IDS } from '../engine/challenges';
import { ALL_JOKERS } from '../engine/jokers';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import type {
  BlindState, ChallengeId, PatternId, PouchId, RecordId, RunState, ScoreEvent,
  SentenceJudgment, Tile, WordSubmission,
} from '../engine/types';

export const STEAM_STAT_NAMES = [
  'std_runs', 'std_wins', 'pouches_won', 'records_won',
  'pouch_record_pairs', 'challenges_completed', 'emoji_mastered',
  'emoji_record_sticker_tiers', 'single_hand_score', 'last_word_target',
  'long_read', 'longform', 'perfect_syntax', 'emoji_effects_one_hand',
  'no_revisions', 'under_30_hands', 'glass_destroyed_one_hand',
  'fully_loaded_tile', 'pattern_run_max', 'word_hand_run_max',
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
  bestHandScore: number;
  lastWordTarget: boolean;
  longRead: boolean;
  longform: boolean;
  perfectSyntax: boolean;
  maxEmojiEffectsInHand: number;
  noRevisions: boolean;
  underThirtyHands: boolean;
  maxGlassDestroyedInHand: number;
  fullyLoadedTile: boolean;
  maxPatternUsesInRun: number;
  maxWordHandUsesInRun: number;
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
  bestHandScore: 0, lastWordTarget: false, longRead: false, longform: false,
  perfectSyntax: false, maxEmojiEffectsInHand: 0, noRevisions: false,
  underThirtyHands: false, maxGlassDestroyedInHand: 0, fullyLoadedTile: false,
  maxPatternUsesInRun: 0, maxWordHandUsesInRun: 0,
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
    bestHandScore: 0,
    lastWordTarget: false,
    longRead: false,
    longform: false,
    perfectSyntax: false,
    maxEmojiEffectsInHand: 0,
    noRevisions: false,
    underThirtyHands: false,
    maxGlassDestroyedInHand: 0,
    fullyLoadedTile: false,
    maxPatternUsesInRun: 0,
    maxWordHandUsesInRun: 0,
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
    bestHandScore: count(raw.bestHandScore),
    lastWordTarget: raw.lastWordTarget === true,
    longRead: raw.longRead === true,
    longform: raw.longform === true,
    perfectSyntax: raw.perfectSyntax === true,
    maxEmojiEffectsInHand: count(raw.maxEmojiEffectsInHand),
    noRevisions: raw.noRevisions === true,
    underThirtyHands: raw.underThirtyHands === true,
    maxGlassDestroyedInHand: count(raw.maxGlassDestroyedInHand),
    fullyLoadedTile: raw.fullyLoadedTile === true,
    maxPatternUsesInRun: count(raw.maxPatternUsesInRun),
    maxWordHandUsesInRun: count(raw.maxWordHandUsesInRun),
  };
}

const hasAllEnhancements = (tile: Tile): boolean =>
  tile.material !== 'ceramic' && tile.font !== 'medium' && (tile.edition ?? 'base') !== 'base';

export function recordSteamEligibleTiles(
  ledger: SteamEligibleV1,
  before: RunState,
  after: RunState,
): SteamEligibleV1 {
  const next = normalizeSteamEligible(ledger, {});
  const beforeById = new Map(before.bag.map((tile) => [tile.id, tile]));
  next.fullyLoadedTile ||= after.bag.some((tile) => {
    const prior = beforeById.get(tile.id);
    return prior !== undefined && !hasAllEnhancements(prior) && hasAllEnhancements(tile);
  });
  return next;
}

export function recordSteamEligibleHand(
  ledger: SteamEligibleV1,
  result: {
    run: RunState;
    blind: BlindState;
    submission: WordSubmission;
    events: readonly ScoreEvent[];
    standard: boolean;
    previousProjectedScore?: number;
  },
): SteamEligibleV1 {
  const next = normalizeSteamEligible(ledger, {});
  next.bestHandScore = Math.max(next.bestHandScore, count(result.submission.settledScore));
  next.lastWordTarget ||= (result.previousProjectedScore ?? 0) < result.blind.target &&
    result.blind.phasesUsed === result.blind.phasesTotal &&
    result.blind.projectedScore >= result.blind.target;
  next.maxEmojiEffectsInHand = Math.max(next.maxEmojiEffectsInHand,
    new Set(result.events.flatMap((event) => event.kind === 'joker' ? [event.jokerId] : [])).size);
  next.maxGlassDestroyedInHand = Math.max(next.maxGlassDestroyedInHand,
    result.submission.tiles.filter((tile) => tile.material === 'glass' &&
      result.submission.destroyedTileIds?.includes(tile.id)).length);
  if (result.standard) {
    next.maxWordHandUsesInRun = Math.max(next.maxWordHandUsesInRun,
      ...Object.values(result.run.letterHandPlayCounts ?? {}).map(count));
  }
  return next;
}

export function recordSteamEligibleSentence(
  ledger: SteamEligibleV1,
  result: {
    sequence: readonly WordSubmission[];
    judgment: SentenceJudgment;
    patternCounts: Partial<Record<PatternId, number>>;
    standard: boolean;
  },
): SteamEligibleV1 {
  const next = normalizeSteamEligible(ledger, {});
  if (result.judgment.match) {
    next.longRead ||= result.sequence.some((word) => word.tiles.length >= 10);
    next.longform ||= result.sequence.length >= 6;
    next.perfectSyntax ||= result.judgment.match.pattern === 'complex';
  }
  if (result.standard) {
    next.maxPatternUsesInRun = Math.max(next.maxPatternUsesInRun,
      ...Object.values(result.patternCounts).map(count));
  }
  return next;
}

export function recordSteamEligibleRun(
  ledger: SteamEligibleV1,
  result: {
    won: boolean; standard: boolean; challengeId?: ChallengeId | null;
    challengeCompleted?: boolean; pouchId?: PouchId; recordId?: RecordId;
    jokerIds?: readonly string[]; handsPlayed?: number; rerollsUsed?: number;
    patternCounts?: Partial<Record<PatternId, number>>;
    letterHandPlayCounts?: RunState['letterHandPlayCounts'];
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
  if (result.standard) {
    next.maxPatternUsesInRun = Math.max(next.maxPatternUsesInRun,
      ...Object.values(result.patternCounts ?? {}).map(count));
    next.maxWordHandUsesInRun = Math.max(next.maxWordHandUsesInRun,
      ...Object.values(result.letterHandPlayCounts ?? {}).map(count));
    if (result.won) {
      next.noRevisions ||= result.rerollsUsed === 0;
      next.underThirtyHands ||= typeof result.handsPlayed === 'number' &&
        result.handsPlayed >= 0 && result.handsPlayed <= 30;
    }
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
  let bestHandScore = 0;
  let maxEmojiEffectsInHand = 0;
  let maxGlassDestroyedInHand = 0;
  let maxPatternUsesInRun = 0;
  let maxWordHandUsesInRun = 0;
  let lastWordTarget = false;
  let longRead = false;
  let longform = false;
  let perfectSyntax = false;
  let noRevisions = false;
  let underThirtyHands = false;
  let fullyLoadedTile = false;
  for (const ledger of ledgers) {
    const normalized = normalizeSteamEligible(ledger, {});
    standardRuns = count(standardRuns + normalized.standardRuns);
    standardWins = count(standardWins + normalized.standardWins);
    bestHandScore = Math.max(bestHandScore, normalized.bestHandScore);
    maxEmojiEffectsInHand = Math.max(maxEmojiEffectsInHand, normalized.maxEmojiEffectsInHand);
    maxGlassDestroyedInHand = Math.max(maxGlassDestroyedInHand, normalized.maxGlassDestroyedInHand);
    maxPatternUsesInRun = Math.max(maxPatternUsesInRun, normalized.maxPatternUsesInRun);
    maxWordHandUsesInRun = Math.max(maxWordHandUsesInRun, normalized.maxWordHandUsesInRun);
    lastWordTarget ||= normalized.lastWordTarget;
    longRead ||= normalized.longRead;
    longform ||= normalized.longform;
    perfectSyntax ||= normalized.perfectSyntax;
    noRevisions ||= normalized.noRevisions;
    underThirtyHands ||= normalized.underThirtyHands;
    fullyLoadedTile ||= normalized.fullyLoadedTile;
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
    single_hand_score: bestHandScore,
    last_word_target: Number(lastWordTarget),
    long_read: Number(longRead),
    longform: Number(longform),
    perfect_syntax: Number(perfectSyntax),
    emoji_effects_one_hand: maxEmojiEffectsInHand,
    no_revisions: Number(noRevisions),
    under_30_hands: Number(underThirtyHands),
    glass_destroyed_one_hand: maxGlassDestroyedInHand,
    fully_loaded_tile: Number(fullyLoadedTile),
    pattern_run_max: maxPatternUsesInRun,
    word_hand_run_max: maxWordHandUsesInRun,
  };
}
