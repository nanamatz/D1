/**
 * RunState construction (GDD §8). A run is fully described by its seed plus the
 * evolving deck/joker/economy state; slices ①–③ only exercise the deck + loop
 * fields, but the whole shape is initialized here so later slices have a home.
 */

import { BALANCE } from './balance';
import { buildBag } from './bag';
import { applyStartingPouch } from './pouches';
import { applyStartingRecord } from './records';
import { challengeDef, isChallengeId } from './challenges';
import { makeRng } from './rng';
import {
  EMPTY_NEXT_BLIND_BONUS,
  rollSkipOffers,
} from './skipRewards';
import type {
  PatternId,
  ChallengeId,
  PouchId,
  RecordId,
  RunState,
  ScalingCounters,
  LetterHandId,
} from './types';

function freshPatternLevels(): Record<PatternId, number> {
  const levels = {} as Record<PatternId, number>;
  for (const id of Object.keys(BALANCE.patterns) as PatternId[]) levels[id] = 1;
  return levels;
}

function freshPatternCounts(): Record<PatternId, number> {
  const counts = {} as Record<PatternId, number>;
  for (const id of Object.keys(BALANCE.patterns) as PatternId[]) counts[id] = 0;
  return counts;
}

function freshLetterHandValues(value: number): Record<LetterHandId, number> {
  return Object.fromEntries(
    (Object.keys(BALANCE.letterHands) as LetterHandId[]).map((id) => [id, value]),
  ) as Record<LetterHandId, number>;
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
    unusedDiscards: 0,
  };
}

export interface NewRunOptions {
  pouchId?: PouchId;
  recordId?: RecordId;
  customSeed?: boolean;
  challengeId?: ChallengeId | null;
}

/** A brand-new run at ante 1 with the selected pouch and cumulative Record. */
export function newRun(seed: string, options: NewRunOptions = {}): RunState {
  if (options.challengeId != null && !isChallengeId(options.challengeId)) {
    throw new Error(`Unknown challenge: ${String(options.challengeId)}`);
  }
  if (options.challengeId != null && options.customSeed) {
    throw new Error('Challenges cannot use a custom seed');
  }
  const challenge = options.challengeId ? challengeDef(options.challengeId) : null;
  const run: RunState = {
    pouchId: challenge?.pouchId ?? options.pouchId ?? 'yellow',
    recordId: challenge?.recordId ?? options.recordId ?? 'whiteLp',
    challengeId: challenge?.id ?? null,
    customSeed: challenge ? false : options.customSeed ?? false,
    seed,
    ante: 1,
    victorySecured: false,
    blindIndex: 0,
    skipOffers: [{ id: 'advancePayment' }, { id: 'advancePayment' }],
    skippedThisChapter: [],
    skippedBlinds: 0,
    shopsVisited: 0,
    nextBlindBonus: { ...EMPTY_NEXT_BLIND_BONUS },
    pendingClearReward: 0,
    pendingShopTags: [],
    pendingBossReward: 0,
    gold: BALANCE.startingGold,
    handSize: BALANCE.handSize,
    basePhases: BALANCE.basePhases,
    baseDiscards: BALANCE.discardsPerBlind,
    bag: buildBag(),
    jokers: [],
    consumables: [],
    lastFableOrConstellation: null,
    fablesUsed: 0,
    consumableSlots: BALANCE.consumableSlots,
    jokerSlots: BALANCE.jokerSlots,
    patternLevels: freshPatternLevels(),
    patternPlayCounts: freshPatternCounts(),
    vouchers: [],
    voucherOffer: null, // rolled at run start / each new chapter (playtest-03 C)
    voucherLocked: false,
    voucherBasesBoughtThisChapter: [],
    chapterBossId: null, // drawn at chapter start (playtest-04 D-6)
    bossHistory: [],
    wordsThisAnte: [], // reset per Chapter; read by Memoirs and Stereotype Plate
    playedWords: [],
    playedLetterHands: [],
    letterHandPlayCounts: {},
    letterHandLevels: freshLetterHandValues(1),
    letterHandStamps: freshLetterHandValues(0),
    lastLetterHand: null,
    discardedLetters: [],
    discardedLetterCounts: {},
    bossRerollsUsed: 0,
    counters: freshCounters(),
  };
  const configured = applyStartingRecord(
    applyStartingPouch(run, makeRng(`${seed}#starting-pouch`)),
  );
  return {
    ...configured,
    skipOffers: rollSkipOffers(configured, makeRng(`${seed}#skip-1`)),
  };
}
