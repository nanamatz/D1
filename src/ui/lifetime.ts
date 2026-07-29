/**
 * Lifetime player stats (spec §2.12 Statistics), accumulated in localStorage
 * across runs. Recorded once per run at Game Over. Pure observation — no engine
 * coupling.
 */

import { readValue, writeValue } from './storage';

const KEY = 'wj.lifetime';

export interface Lifetime {
  runs: number;
  highestAnte: number;
  bestWordScore: number;
  bestWord: string;
  mostGold: number;
}

const EMPTY: Lifetime = { runs: 0, highestAnte: 0, bestWordScore: 0, bestWord: '', mostGold: 0 };

export function loadLifetime(): Lifetime {
  const stored = readValue<Partial<Lifetime>>(KEY);
  return stored ? { ...EMPTY, ...stored } : { ...EMPTY };
}

export interface RunResult {
  ante: number;
  gold: number;
  bestWord: { text: string; score: number } | null;
}

/** Fold one finished run into the lifetime record (idempotency is the caller's job). */
export function recordRunEnd(r: RunResult): void {
  const lt = loadLifetime();
  const next: Lifetime = {
    runs: lt.runs + 1,
    highestAnte: Math.max(lt.highestAnte, r.ante),
    bestWordScore: Math.max(lt.bestWordScore, r.bestWord?.score ?? 0),
    bestWord: (r.bestWord?.score ?? 0) > lt.bestWordScore ? (r.bestWord?.text ?? '') : lt.bestWord,
    mostGold: Math.max(lt.mostGold, r.gold),
  };
  writeValue(KEY, next);
}
