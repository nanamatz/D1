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
  type ProfileSlot,
} from './storage';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import type { PouchId, RecordId } from '../engine/types';
import { wordLetterChips } from '../engine/scoring';
import { collectionHighlights, loadCollection } from './collection';

const KEY = 'wj.lifetime';

export interface Lifetime {
  profileCreated: boolean;
  profileName: string;
  unlockAllWarned: boolean;
  unlockAllApplied: boolean;
  challengesDisabled: boolean;
  runs: number;
  wins: number;
  highestAnte: number;
  highestEndlessAnte: number;
  bestEndlessScore: number;
  bestWordScore: number;
  bestWord: string;
  mostGold: number;
  pouchWins: PouchId[];
  /** Aggregate wins used by Starting Pouch unlock conditions. */
  recordWins: RecordId[];
  /** Record ladder progress is independent for every Starting Pouch. */
  recordWinsByPouch: Partial<Record<PouchId, RecordId[]>>;
  balance: BalanceTelemetry;
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
  runs: 0,
  wins: 0,
  highestAnte: 0,
  highestEndlessAnte: 0,
  bestEndlessScore: 0,
  bestWordScore: 0,
  bestWord: '',
  mostGold: 0,
  pouchWins: [],
  recordWins: [],
  recordWinsByPouch: {},
  balance: {
    version: 1,
    runs: 0,
    wins: 0,
    lossesByChapter: {},
  },
});

const safeCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

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

export function loadLifetime(slot: ProfileSlot = activeProfile()): Lifetime {
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
  const collectionBest = collectionHighlights(loadCollection(slot)).highestScore;
  const bestWord = collectionBest?.word ?? storedBestWord;
  const recordWins = normalizeRecordWins(stored.recordWins);
  const recordWinsByPouch = stored.recordWinsByPouch === undefined
    ? (recordWins.length > 0 ? { yellow: recordWins } : {})
    : normalizeRecordWinsByPouch(stored.recordWinsByPouch);
  return {
    ...empty,
    ...stored,
    profileCreated,
    profileName: profileCreated ? storedName || `P${slot}` : '',
    unlockAllWarned: stored.unlockAllWarned === true,
    unlockAllApplied: stored.unlockAllApplied === true,
    challengesDisabled: stored.challengesDisabled === true,
    bestWord,
    bestWordScore: collectionBest?.value ?? wordLetterChips(bestWord),
    pouchWins: Array.isArray(stored.pouchWins)
      ? stored.pouchWins.filter((id): id is PouchId => POUCH_IDS.includes(id as PouchId))
      : [],
    recordWins,
    recordWinsByPouch,
    balance: normalizeBalance(stored.balance),
  };
}

export function writeLifetime(lifetime: Lifetime, slot: ProfileSlot = activeProfile()): void {
  writeProfileValue(KEY, slot, lifetime);
}

export interface RunResult {
  ante: number;
  gold: number;
  bestWord: { text: string; score: number } | null;
  won?: boolean;
  pouchId?: PouchId;
  recordId?: RecordId;
  customSeed?: boolean;
}

/** Fold one finished run into the lifetime record (idempotency is the caller's job). */
export function recordRunEnd(r: RunResult): void {
  const lt = loadLifetime();
  const pouchWins = new Set(lt.pouchWins);
  const recordWins = new Set(lt.recordWins);
  const recordWinsByPouch = { ...lt.recordWinsByPouch };
  if (r.won && !r.customSeed) {
    if (r.pouchId) pouchWins.add(r.pouchId);
    if (r.recordId) recordWins.add(r.recordId);
    if (r.pouchId && r.recordId) {
      recordWinsByPouch[r.pouchId] = [
        ...new Set([...(recordWinsByPouch[r.pouchId] ?? []), r.recordId]),
      ];
    }
  }
  const balance = { ...lt.balance, lossesByChapter: { ...lt.balance.lossesByChapter } };
  if (!r.customSeed) {
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
    highestAnte: Math.max(lt.highestAnte, r.ante),
    bestWordScore: Math.max(lt.bestWordScore, r.bestWord?.score ?? 0),
    bestWord: (r.bestWord?.score ?? 0) > lt.bestWordScore ? (r.bestWord?.text ?? '') : lt.bestWord,
    mostGold: Math.max(lt.mostGold, r.gold),
    pouchWins: [...pouchWins],
    recordWins: [...recordWins],
    recordWinsByPouch,
    balance,
  };
  writeLifetime(next);
}

/** Endless is a benchmark attached to an already-recorded win, not a second run. */
export function recordEndlessEnd(r: { ante: number; bestScore: number }): void {
  const lt = loadLifetime();
  writeLifetime({
    ...lt,
    highestEndlessAnte: Math.max(lt.highestEndlessAnte, r.ante),
    bestEndlessScore: Math.max(lt.bestEndlessScore, r.bestScore),
  });
}
