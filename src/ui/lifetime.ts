/**
 * Lifetime player stats (spec §2.12 Statistics), accumulated in localStorage
 * across runs. Recorded once per run at Game Over. Pure observation — no engine
 * coupling.
 */

import { readValue, writeValue } from './storage';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import type { PouchId, RecordId } from '../engine/types';

const KEY = 'wj.lifetime';

export interface Lifetime {
  runs: number;
  highestAnte: number;
  bestWordScore: number;
  bestWord: string;
  mostGold: number;
  pouchWins: PouchId[];
  recordWins: RecordId[];
}

const EMPTY: Lifetime = {
  runs: 0,
  highestAnte: 0,
  bestWordScore: 0,
  bestWord: '',
  mostGold: 0,
  pouchWins: [],
  recordWins: [],
};

export function loadLifetime(): Lifetime {
  const stored = readValue<Partial<Lifetime>>(KEY);
  if (!stored) return { ...EMPTY };
  return {
    ...EMPTY,
    ...stored,
    pouchWins: Array.isArray(stored.pouchWins)
      ? stored.pouchWins.filter((id): id is PouchId => POUCH_IDS.includes(id as PouchId))
      : [],
    recordWins: Array.isArray(stored.recordWins)
      ? stored.recordWins.filter((id): id is RecordId => RECORD_IDS.includes(id as RecordId))
      : [],
  };
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
  if (r.won && !r.customSeed) {
    if (r.pouchId) pouchWins.add(r.pouchId);
    if (r.recordId) recordWins.add(r.recordId);
  }
  const next: Lifetime = {
    runs: lt.runs + 1,
    highestAnte: Math.max(lt.highestAnte, r.ante),
    bestWordScore: Math.max(lt.bestWordScore, r.bestWord?.score ?? 0),
    bestWord: (r.bestWord?.score ?? 0) > lt.bestWordScore ? (r.bestWord?.text ?? '') : lt.bestWord,
    mostGold: Math.max(lt.mostGold, r.gold),
    pouchWins: [...pouchWins],
    recordWins: [...recordWins],
  };
  writeValue(KEY, next);
}
