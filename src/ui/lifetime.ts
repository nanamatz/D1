/**
 * Lifetime player stats (spec §2.12 Statistics), accumulated in localStorage
 * across runs. Recorded once per run at Game Over. Pure observation — no engine
 * coupling.
 */

import {
  activeProfile,
  profileHasData,
  readProfileValue,
  writeProfileValue,
  PROFILE_SLOTS,
  syncSteamStats,
  steamSyncAvailable,
  steamEvidenceEligible,
  steamAggregateSyncAllowed,
  subscribeSteamOwnership,
  type ProfileSlot,
} from './storage';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import {
  CHALLENGE_IDS,
  isChallengeId,
  isChallengeUnlocked,
} from '../engine/challenges';
import { ALL_JOKERS } from '../engine/jokers';
import { KNOWLEDGE_LETTER_HAND_IDS, isKnowledgeLetterHand } from '../engine/letterHands';
import type { ChallengeId, LetterHandId, PouchId, RecordId } from '../engine/types';
import type { PatternId } from '../engine/types';
import { BALANCE } from '../engine/balance';
import { wordLetterChips } from '../engine/scoring';
import { collectionHighlights, loadCollection, type Collection } from './collection';
import { isProfileTitleId, type ProfileTitleId } from './profileTitles';
import {
  aggregateSteamEligible,
  emptySteamEligible,
  normalizeSteamEligible,
  recordSteamEligibleRun,
  type SteamEligibleV1,
} from './steamAchievements';

const KEY = 'wj.lifetime';

export interface Lifetime {
  profileCreated: boolean;
  profileName: string;
  unlockAllWarned: boolean;
  unlockAllApplied: boolean;
  challengesDisabled: boolean;
  completedChallenges: ChallengeId[];
  /** Cosmetic profile title stored by stable semantic id. */
  equippedRegisterTitle: ProfileTitleId | null;
  runs: number;
  wins: number;
  currentWinStreak: number;
  bestWinStreak: number;
  patternPlayCounts: Partial<Record<PatternId, number>>;
  /** Finalized blinds completed while each production Emoji Tile was owned. */
  jokerBlindsCompleted: Partial<Record<string, number>>;
  /** Durable idempotency token and already-folded pattern total for the latest run. */
  lastRunObservation: LifetimeRunObservation | null;
  highestAnte: number;
  highestEndlessAnte: number;
  bestRoundScore: number;
  bestEndlessScore: number;
  bestWordScore: number;
  bestWord: string;
  mostGold: number;
  /** Profile-wide reveal state for the three secret knowledge-tier Word Hands. */
  discoveredLetterHands: LetterHandId[];
  pouchWins: PouchId[];
  /** Aggregate wins used by Starting Pouch unlock conditions. */
  recordWins: RecordId[];
  /** Record ladder progress is independent for every Starting Pouch. */
  recordWinsByPouch: Partial<Record<PouchId, RecordId[]>>;
  /** Highest Record cleared while each production Emoji Tile remained owned. */
  jokerRecordStickers: Partial<Record<string, RecordId>>;
  steamEligible: SteamEligibleV1;
  balance: BalanceTelemetry;
}

export interface LifetimeRunObservation {
  id: string;
  runEndRecorded: boolean;
  patternBaseline: Partial<Record<PatternId, number>>;
  jokerBaseline: Partial<Record<string, number>>;
}

/** Unseeded human-run outcomes used for target/balance review. */
export interface BalanceTelemetry {
  version: 1;
  runs: number;
  wins: number;
  lossesByChapter: Record<string, number>;
}

const emptyLifetime = (slot: ProfileSlot): Lifetime => ({
  profileCreated: slot === 1,
  profileName: slot === 1 ? 'P1' : '',
  unlockAllWarned: false,
  unlockAllApplied: false,
  challengesDisabled: false,
  completedChallenges: [],
  equippedRegisterTitle: null,
  runs: 0,
  wins: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  patternPlayCounts: {},
  jokerBlindsCompleted: {},
  lastRunObservation: null,
  highestAnte: 0,
  highestEndlessAnte: 0,
  bestRoundScore: 0,
  bestEndlessScore: 0,
  bestWordScore: 0,
  bestWord: '',
  mostGold: 0,
  discoveredLetterHands: [],
  pouchWins: [],
  recordWins: [],
  recordWinsByPouch: {},
  jokerRecordStickers: {},
  steamEligible: emptySteamEligible(),
  balance: {
    version: 1,
    runs: 0,
    wins: 0,
    lossesByChapter: {},
  },
});

const safeCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

const productionJokerIds = new Set(ALL_JOKERS.map((joker) => joker.id));

function normalizeBalance(value: unknown): BalanceTelemetry {
  const stored =
    value && typeof value === 'object' ? (value as Partial<BalanceTelemetry>) : {};
  const lossesByChapter: Record<string, number> = {};
  if (stored.lossesByChapter && typeof stored.lossesByChapter === 'object') {
    for (const [chapter, count] of Object.entries(stored.lossesByChapter)) {
      const parsed = Number(chapter);
      const safe = safeCount(count);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 38 && safe > 0) {
        lossesByChapter[String(parsed)] = safe;
      }
    }
  }
  const runs = safeCount(stored.runs);
  return {
    version: 1,
    runs,
    wins: Math.min(runs, safeCount(stored.wins)),
    lossesByChapter,
  };
}

function normalizeRecordWins(value: unknown): RecordId[] {
  return Array.isArray(value)
    ? value.filter((id): id is RecordId => RECORD_IDS.includes(id as RecordId))
    : [];
}

function normalizeCompletedChallenges(value: unknown): ChallengeId[] {
  const completed = new Set(
    Array.isArray(value) ? value.filter(isChallengeId) : [],
  );
  const normalized: ChallengeId[] = [];
  for (const id of CHALLENGE_IDS) {
    if (!completed.has(id)) break;
    normalized.push(id);
  }
  return normalized;
}

function normalizeDiscoveredLetterHands(value: unknown): LetterHandId[] {
  return Array.isArray(value)
    ? value.filter((id): id is LetterHandId =>
        typeof id === 'string' && KNOWLEDGE_LETTER_HAND_IDS.includes(
          id as (typeof KNOWLEDGE_LETTER_HAND_IDS)[number],
        ))
    : [];
}

function normalizeRecordWinsByPouch(
  value: unknown,
): Partial<Record<PouchId, RecordId[]>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Partial<Record<PouchId, RecordId[]>> = {};
  for (const pouchId of POUCH_IDS) {
    const wins = normalizeRecordWins((value as Partial<Record<PouchId, unknown>>)[pouchId]);
    if (wins.length > 0) normalized[pouchId] = wins;
  }
  return normalized;
}

function normalizeJokerRecordStickers(
  value: unknown,
): Partial<Record<string, RecordId>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(
    (entry): entry is [string, RecordId] =>
      productionJokerIds.has(entry[0]) && RECORD_IDS.includes(entry[1] as RecordId),
  ));
}

function normalizePatternCounts(value: unknown): Partial<Record<PatternId, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Partial<Record<PatternId, number>> = {};
  for (const id of Object.keys(BALANCE.patterns) as PatternId[]) {
    const count = safeCount((value as Record<string, unknown>)[id]);
    if (count > 0) result[id] = count;
  }
  return result;
}

function normalizeJokerCounts(value: unknown): Partial<Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([id, count]) => productionJokerIds.has(id) && safeCount(count) > 0)
    .map(([id, count]) => [id, safeCount(count)]));
}

function normalizeRunObservation(value: unknown): LifetimeRunObservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<LifetimeRunObservation>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  return {
    id: raw.id,
    runEndRecorded: raw.runEndRecorded === true,
    patternBaseline: normalizePatternCounts(raw.patternBaseline),
    jokerBaseline: normalizeJokerCounts(raw.jokerBaseline),
  };
}

export function mostPlayedPattern(
  counts: Partial<Record<PatternId, number>>,
): { id: PatternId; count: number } | null {
  let best: { id: PatternId; count: number } | null = null;
  for (const id of Object.keys(BALANCE.patterns) as PatternId[]) {
    const count = safeCount(counts[id]);
    if (count > 0 && (!best || count > best.count ||
      (count === best.count && BALANCE.patterns[id].rank > BALANCE.patterns[best.id].rank))) {
      best = { id, count };
    }
  }
  return best;
}

export function recordWinsForPouch(
  lifetime: Pick<Lifetime, 'recordWinsByPouch'>,
  pouchId: PouchId,
): ReadonlySet<RecordId> {
  return new Set(lifetime.recordWinsByPouch[pouchId] ?? []);
}

export function recordWinCount(
  lifetime: Pick<Lifetime, 'recordWinsByPouch'>,
): number {
  return POUCH_IDS.reduce(
    (total, pouchId) => total + new Set(lifetime.recordWinsByPouch[pouchId] ?? []).size,
    0,
  );
}

export const JOKER_RECORD_STICKER_TOTAL = ALL_JOKERS.length * RECORD_IDS.length;

/** Balatro-style progress: a tier-N sticker also counts every lower Record. */
export function jokerRecordStickerCount(
  lifetime: Pick<Lifetime, 'jokerRecordStickers'>,
): number {
  return Object.values(lifetime.jokerRecordStickers).reduce(
    (total, id) => total + (id ? RECORD_IDS.indexOf(id) + 1 : 0),
    0,
  );
}

export function loadLifetime(
  slot: ProfileSlot = activeProfile(),
  collection: Collection = loadCollection(slot),
): Lifetime {
  return normalizeLifetime(slot, collection);
}

/** Mutation path: never scan/allocate the potentially huge word collection. */
function loadLifetimeForMutation(slot: ProfileSlot = activeProfile()): Lifetime {
  return normalizeLifetime(slot, null);
}

function normalizeLifetime(slot: ProfileSlot, collection: Collection | null): Lifetime {
  const stored = readProfileValue<Partial<Lifetime>>(KEY, slot);
  const empty = emptyLifetime(slot);
  if (!stored) {
    const profileCreated = slot === 1 || profileHasData(slot);
    return {
      ...empty,
      profileCreated,
      profileName: profileCreated ? `P${slot}` : '',
    };
  }
  const profileCreated = stored.profileCreated ?? true;
  const storedName = typeof stored.profileName === 'string' ? stored.profileName.trim() : '';
  const storedBestWord = typeof stored.bestWord === 'string' ? stored.bestWord : '';
  const collectionBest = collection ? collectionHighlights(collection).highestScore : null;
  const bestWord = collectionBest?.word ?? storedBestWord;
  const recordWins = normalizeRecordWins(stored.recordWins);
  const recordWinsByPouch = stored.recordWinsByPouch === undefined
    ? (recordWins.length > 0 ? { yellow: recordWins } : {})
    : normalizeRecordWinsByPouch(stored.recordWinsByPouch);
  const balance = normalizeBalance(stored.balance);
  const completedChallenges = normalizeCompletedChallenges(stored.completedChallenges);
  const pouchWins = Array.isArray(stored.pouchWins)
    ? stored.pouchWins.filter((id): id is PouchId => POUCH_IDS.includes(id as PouchId)) : [];
  const jokerRecordStickers = normalizeJokerRecordStickers(stored.jokerRecordStickers);
  const steamEligible = normalizeSteamEligible(stored.steamEligible, {
    unlockAllApplied: stored.unlockAllApplied === true,
    balance, pouchWins, recordWins, recordWinsByPouch, completedChallenges, jokerRecordStickers,
  });
  return {
    ...empty,
    ...stored,
    profileCreated,
    profileName: profileCreated ? storedName || `P${slot}` : '',
    unlockAllWarned: stored.unlockAllWarned === true,
    unlockAllApplied: stored.unlockAllApplied === true,
    challengesDisabled: stored.challengesDisabled === true,
    completedChallenges,
    equippedRegisterTitle: isProfileTitleId(stored.equippedRegisterTitle)
      ? stored.equippedRegisterTitle
      : null,
    runs: safeCount(stored.runs),
    wins: safeCount(stored.wins),
    currentWinStreak: safeCount(stored.currentWinStreak),
    bestWinStreak: safeCount(stored.bestWinStreak),
    patternPlayCounts: normalizePatternCounts(stored.patternPlayCounts),
    jokerBlindsCompleted: normalizeJokerCounts(stored.jokerBlindsCompleted),
    lastRunObservation: normalizeRunObservation(stored.lastRunObservation),
    bestRoundScore: safeCount(stored.bestRoundScore),
    bestWord,
    bestWordScore: collectionBest?.value ??
      (collection ? wordLetterChips(bestWord) : safeCount(stored.bestWordScore) || wordLetterChips(bestWord)),
    discoveredLetterHands: normalizeDiscoveredLetterHands(stored.discoveredLetterHands),
    pouchWins,
    recordWins,
    recordWinsByPouch,
    jokerRecordStickers,
    steamEligible,
    balance,
  };
}

export function writeLifetime(lifetime: Lifetime, slot: ProfileSlot = activeProfile()): void {
  writeProfileValue(KEY, slot, lifetime);
}

function syncSteamProgress(): void {
  if (!steamSyncAvailable() || !steamAggregateSyncAllowed()) return;
  syncSteamStats(aggregateSteamEligible(
    PROFILE_SLOTS.map((slot) => normalizeLifetime(slot, null).steamEligible),
  ));
}

export function initializeSteamAchievements(): () => void {
  const migrateMissingLedgers = () => {
    if (!steamEvidenceEligible()) return;
    for (const slot of PROFILE_SLOTS) {
      const stored = readProfileValue<Partial<Lifetime>>(KEY, slot);
      if (!stored || stored.steamEligible?.version === 1) continue;
      writeProfileValue(KEY, slot, normalizeLifetime(slot, null));
    }
  };
  const unsubscribe = subscribeSteamOwnership(() => {
    if (!steamEvidenceEligible()) return;
    migrateMissingLedgers();
    syncSteamProgress();
  });
  migrateMissingLedgers();
  syncSteamProgress();
  return unsubscribe;
}

/** Cheap Challenge UI read; avoids scanning the word collection. */
export function loadChallengeProgress(
  slot: ProfileSlot = activeProfile(),
): Pick<Lifetime, 'challengesDisabled' | 'completedChallenges'> {
  const stored = readProfileValue<Partial<Lifetime>>(KEY, slot);
  return {
    challengesDisabled: stored?.challengesDisabled === true,
    completedChallenges: normalizeCompletedChallenges(stored?.completedChallenges),
  };
}

/** Cheap profile read for render paths: avoids the collection scan in loadLifetime(). */
export function loadDiscoveredLetterHands(
  slot: ProfileSlot = activeProfile(),
): ReadonlySet<LetterHandId> {
  const stored = readProfileValue<Pick<Lifetime, 'discoveredLetterHands'>>(KEY, slot);
  return new Set(normalizeDiscoveredLetterHands(stored?.discoveredLetterHands));
}

export function isLetterHandDiscovered(
  id: LetterHandId,
  discovered: ReadonlySet<LetterHandId> = loadDiscoveredLetterHands(),
): boolean {
  return !isKnowledgeLetterHand(id) || discovered.has(id);
}

export function discoverLetterHand(
  id: LetterHandId,
  slot: ProfileSlot = activeProfile(),
): void {
  if (!isKnowledgeLetterHand(id)) return;
  const discovered = loadDiscoveredLetterHands(slot);
  if (discovered.has(id)) return;
  writeLifetime({
    ...loadLifetime(slot),
    discoveredLetterHands: [...discovered, id],
  }, slot);
}

/** Record one fully finalized blind score as soon as the round resolves. */
export function recordBestRoundScore(score: number): void {
  const lifetime = loadLifetimeForMutation();
  const bestRoundScore = Math.max(lifetime.bestRoundScore, safeCount(score));
  if (bestRoundScore !== lifetime.bestRoundScore) {
    writeLifetime({ ...lifetime, bestRoundScore });
  }
}

export interface RunResult {
  observationId?: string;
  ante: number;
  gold: number;
  bestWord: { text: string; score: number } | null;
  won?: boolean;
  pouchId?: PouchId;
  recordId?: RecordId;
  customSeed?: boolean;
  challengeId?: ChallengeId | null;
  /** Production Emoji Tiles still owned after Chapter 8 blind-end hooks resolve. */
  jokerIds?: readonly string[];
  patternCounts?: Partial<Record<PatternId, number>>;
}

/** Fold one finished run into the lifetime record (idempotency is the caller's job). */
export function recordRunEnd(r: RunResult): void {
  const lt = loadLifetime();
  if (r.observationId && lt.lastRunObservation?.id === r.observationId &&
      lt.lastRunObservation.runEndRecorded) return;
  const pouchWins = new Set(lt.pouchWins);
  const recordWins = new Set(lt.recordWins);
  const recordWinsByPouch = { ...lt.recordWinsByPouch };
  const jokerRecordStickers = { ...lt.jokerRecordStickers };
  const completedChallenges = new Set(lt.completedChallenges);
  const patternPlayCounts = { ...lt.patternPlayCounts };
  for (const [id, count] of Object.entries(normalizePatternCounts(r.patternCounts))) {
    patternPlayCounts[id as PatternId] = (patternPlayCounts[id as PatternId] ?? 0) + safeCount(count);
  }
  const standardWin = r.won && !r.customSeed && r.challengeId == null;
  if (standardWin) {
    if (r.pouchId) pouchWins.add(r.pouchId);
    if (r.recordId) recordWins.add(r.recordId);
    if (r.pouchId && r.recordId) {
      recordWinsByPouch[r.pouchId] = [
        ...new Set([...(recordWinsByPouch[r.pouchId] ?? []), r.recordId]),
      ];
    }
    if (r.recordId) {
      const nextRank = RECORD_IDS.indexOf(r.recordId);
      for (const jokerId of new Set(r.jokerIds ?? [])) {
        if (!productionJokerIds.has(jokerId)) continue;
        const previous = jokerRecordStickers[jokerId];
        if (!previous || nextRank > RECORD_IDS.indexOf(previous)) {
          jokerRecordStickers[jokerId] = r.recordId;
        }
      }
    }
  }
  let challengeCompleted = false;
  if (
    r.won &&
    r.ante === BALANCE.runAntes &&
    !r.customSeed &&
    isChallengeId(r.challengeId) &&
    !lt.challengesDisabled &&
    isChallengeUnlocked(r.challengeId, completedChallenges)
  ) {
    completedChallenges.add(r.challengeId);
    challengeCompleted = true;
  }
  const balance = { ...lt.balance, lossesByChapter: { ...lt.balance.lossesByChapter } };
  if (!r.customSeed && r.challengeId == null) {
    balance.runs += 1;
    balance.wins += r.won ? 1 : 0;
    if (!r.won) {
      const chapter = String(Math.min(38, Math.max(1, Math.floor(r.ante))));
      balance.lossesByChapter[chapter] = (balance.lossesByChapter[chapter] ?? 0) + 1;
    }
  }
  const next: Lifetime = {
    ...lt,
    runs: lt.runs + 1,
    wins: lt.wins + (r.won ? 1 : 0),
    currentWinStreak: r.won ? lt.currentWinStreak + 1 : 0,
    bestWinStreak: r.won ? Math.max(lt.bestWinStreak, lt.currentWinStreak + 1) : lt.bestWinStreak,
    patternPlayCounts,
    highestAnte: Math.max(lt.highestAnte, r.ante),
    bestWordScore: Math.max(lt.bestWordScore, r.bestWord?.score ?? 0),
    bestWord: (r.bestWord?.score ?? 0) > lt.bestWordScore ? (r.bestWord?.text ?? '') : lt.bestWord,
    mostGold: Math.max(lt.mostGold, r.gold),
    pouchWins: [...pouchWins],
    recordWins: [...recordWins],
    recordWinsByPouch,
    jokerRecordStickers,
    completedChallenges: CHALLENGE_IDS.filter((id) => completedChallenges.has(id)),
    steamEligible: steamEvidenceEligible() ? recordSteamEligibleRun(lt.steamEligible, {
      won: r.won === true,
      standard: !lt.unlockAllApplied && !r.customSeed && r.challengeId == null,
      ...(r.pouchId ? { pouchId: r.pouchId } : {}),
      ...(r.recordId ? { recordId: r.recordId } : {}),
      ...(r.jokerIds ? { jokerIds: r.jokerIds } : {}),
      ...(r.challengeId !== undefined ? { challengeId: r.challengeId } : {}),
      challengeCompleted,
    }) : lt.steamEligible,
    lastRunObservation: r.observationId ? {
      id: r.observationId,
      runEndRecorded: true,
      patternBaseline: normalizePatternCounts(r.patternCounts),
      jokerBaseline: lt.lastRunObservation?.id === r.observationId
        ? lt.lastRunObservation.jokerBaseline
        : {},
    } : lt.lastRunObservation,
    balance,
  };
  writeLifetime(next);
  syncSteamProgress();
}

/** Endless is a benchmark attached to an already-recorded win, not a second run. */
export function recordEndlessEnd(r: {
  observationId?: string;
  ante: number;
  bestScore: number;
  patternCounts?: Partial<Record<PatternId, number>>;
}): void {
  const lt = loadLifetime();
  const previous = r.observationId && lt.lastRunObservation?.id === r.observationId
    ? lt.lastRunObservation.patternBaseline
    : {};
  const totalPatternCounts = normalizePatternCounts(r.patternCounts);
  const patternDelta: Partial<Record<PatternId, number>> = {};
  for (const id of Object.keys(BALANCE.patterns) as PatternId[]) {
    const delta = Math.max(0, (totalPatternCounts[id] ?? 0) - (previous[id] ?? 0));
    if (delta > 0) patternDelta[id] = delta;
  }
  const patternPlayCounts = { ...lt.patternPlayCounts };
  for (const [id, count] of Object.entries(patternDelta)) {
    patternPlayCounts[id as PatternId] = (patternPlayCounts[id as PatternId] ?? 0) + safeCount(count);
  }
  writeLifetime({
    ...lt,
    highestEndlessAnte: Math.max(lt.highestEndlessAnte, r.ante),
    bestEndlessScore: Math.max(lt.bestEndlessScore, r.bestScore),
    patternPlayCounts,
    lastRunObservation: r.observationId ? {
      id: r.observationId,
      runEndRecorded: true,
      patternBaseline: totalPatternCounts,
      jokerBaseline: lt.lastRunObservation?.id === r.observationId
        ? lt.lastRunObservation.jokerBaseline
        : {},
    } : lt.lastRunObservation,
  });
}

/** Persist finalized-blind observation immediately so abandoning a later blind loses nothing. */
export function recordJokerBlindCounts(
  observationId: string,
  cumulativeTotal: Partial<Record<string, number>>,
): void {
  const total = normalizeJokerCounts(cumulativeTotal);
  const lifetime = loadLifetimeForMutation();
  const previousObservation = lifetime.lastRunObservation?.id === observationId
    ? lifetime.lastRunObservation
    : null;
  const previous = previousObservation?.jokerBaseline ?? {};
  const jokerBlindsCompleted = { ...lifetime.jokerBlindsCompleted };
  const jokerBaseline = { ...previous };
  let changed = previousObservation === null;
  for (const id of productionJokerIds) {
    const current = total[id] ?? 0;
    const baseline = previous[id] ?? 0;
    const delta = Math.max(0, current - baseline);
    if (delta > 0) {
      jokerBlindsCompleted[id] = (jokerBlindsCompleted[id] ?? 0) + delta;
      changed = true;
    }
    // Never roll back a durable baseline when a stale run snapshot is loaded.
    if (current > baseline) jokerBaseline[id] = current;
  }
  if (!changed) return;
  writeLifetime({
    ...lifetime,
    jokerBlindsCompleted,
    lastRunObservation: {
      id: observationId,
      runEndRecorded: previousObservation?.runEndRecorded ?? false,
      patternBaseline: previousObservation?.patternBaseline ?? {},
      jokerBaseline,
    },
  });
}
