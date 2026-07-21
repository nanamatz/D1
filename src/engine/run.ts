/**
 * RunState construction (GDD §8). A run is fully described by its seed plus the
 * evolving deck/joker/economy state; slices ①–③ only exercise the deck + loop
 * fields, but the whole shape is initialized here so later slices have a home.
 */

import { BALANCE } from './balance';
import { buildBag } from './bag';
import type { PatternId, RunState, ScalingCounters } from './types';

function freshPatternLevels(): Record<PatternId, number> {
  const levels = {} as Record<PatternId, number>;
  for (const id of Object.keys(BALANCE.patterns) as PatternId[]) levels[id] = 1;
  return levels;
}

function freshCounters(): ScalingCounters {
  return {
    totalWords: 0,
    formalWords: 0,
    slangWords: 0,
    sentencesCompleted: 0,
    earlyEnds: 0,
    enhancedTilesUsed: 0,
    nonBaseFontTilesUsed: 0,
  };
}

/** A brand-new run at ante 1 with the starting bag and base resources. */
export function newRun(seed: string): RunState {
  return {
    seed,
    ante: 1,
    blindIndex: 0,
    gold: BALANCE.startingGold,
    handSize: BALANCE.handSize,
    basePhases: BALANCE.basePhases,
    baseDiscards: BALANCE.discardsPerBlind,
    bag: buildBag(),
    jokers: [],
    consumables: [],
    consumableSlots: BALANCE.consumableSlots,
    patternLevels: freshPatternLevels(),
    vouchers: [],
    voucherOffer: null, // rolled at run start / each new chapter (playtest-03 C)
    voucherLocked: false,
    chapterBossId: null, // drawn at chapter start (playtest-04 D-6)
    wordsThisAnte: [], // reset per ante; read by Memoirs (회고록)
    counters: freshCounters(),
  };
}
