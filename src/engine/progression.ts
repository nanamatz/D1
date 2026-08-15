/**
 * Blind / ante progression (GDD §8.1). An ante is three blinds — Small → Big →
 * Boss — then the ante rolls over. Clearing a blind pays out the four gold
 * streams (§9.1); missing the target ends the run.
 */

import { BALANCE } from './balance';
import {
  effectiveBlindTarget,
  effectiveClearReward,
  effectiveInterest,
  remainingDiscardGold,
  remainingPhaseGold,
} from './economy';
import type { BlindKind, BlindState, LetterHandId, RunState } from './types';
import { defaultJokerBus } from './jokers';
import { awardBlindLetterHandStamps, type LetterHandStampReward } from './letterHands';
import { makeRng } from './rng';

const KINDS = ['small', 'big', 'boss'] as const;

/** The blind kind for a within-ante index (GDD §8.1). */
export function kindForIndex(index: 0 | 1 | 2): BlindKind {
  return KINDS[index];
}

/** The target the run's current blind must beat (GDD §8.2). */
export function currentTarget(run: RunState): number {
  return effectiveBlindTarget(run, kindForIndex(run.blindIndex));
}

export interface BlindEarnings {
  reward: number;
  /** Delayed Editorial Perks included in reward, shown as their own line item. */
  tagReward: number;
  phaseCount: number;
  phases: number;
  discardCount: number;
  discards: number;
  interest: number;
  total: number;
  letterHandReward: LetterHandStampReward | null;
}

export interface BlindOutcome {
  cleared: boolean;
  gameOver: boolean;
  /** cleared the final chapter's Boss — the run is won (GDD §8.2); endless mode
   *  (planned) will consume `run`/`earned` to continue past this instead */
  won: boolean;
  /** Chapter 38 Deadline cleared; the intentional Number-safe endpoint. */
  endlessComplete: boolean;
  earned: BlindEarnings;
  /** the run after payout + advancement (unchanged on a miss) */
  run: RunState;
}

const NO_EARNINGS: BlindEarnings = {
  reward: 0,
  tagReward: 0,
  phaseCount: 0,
  phases: 0,
  discardCount: 0,
  discards: 0,
  interest: 0,
  total: 0,
  letterHandReward: null,
};

function advance(ante: number, blindIndex: 0 | 1 | 2): { ante: number; blindIndex: 0 | 1 | 2 } {
  if (blindIndex < 2) return { ante, blindIndex: (blindIndex + 1) as 0 | 1 | 2 };
  return { ante: ante + 1, blindIndex: 0 };
}

/**
 * Resolve a finished blind (GDD §7.4 → §9.1). If the final score cleared the
 * target, pay reward + remaining-phase gold + interest and advance; otherwise
 * the run is over.
 */
export function resolveBlind(
  run: RunState,
  blind: BlindState,
  finalScore: number,
  eligibleRandomLetterHands?: readonly LetterHandId[],
): BlindOutcome {
  if (finalScore < blind.target) {
    return {
      cleared: false,
      gameOver: true,
      won: false,
      endlessComplete: false,
      earned: NO_EARNINGS,
      run,
    };
  }
  const reward = effectiveClearReward(run, blind.kind, blind.bossId) + (blind.clearRewardBonus ?? 0);
  const tagReward = run.pendingClearReward
    + (blind.kind === 'boss' ? (run.pendingBossReward ?? 0) : 0)
    + (blind.clearRewardBonus ?? 0);
  const phaseCount = blind.phasesTotal - blind.phasesUsed;
  const phases = remainingPhaseGold(run, phaseCount);
  const discardCount = blind.discardsLeft;
  const discards = remainingDiscardGold(run, discardCount);
  const interestScoring = { run, interest: effectiveInterest(run) };
  defaultJokerBus.emit('interestScoring', interestScoring, run.jokers);
  const interestGold = interestScoring.interest;
  defaultJokerBus.emit('interestResolved', { run, interest: interestGold }, run.jokers);
  const total = reward + phases + discards + interestGold;
  const mastery = awardBlindLetterHandStamps(
    run,
    blind,
    makeRng(`${run.seed}#word-hand-stamp-${run.ante}-${run.blindIndex}`),
    eligibleRandomLetterHands,
  );
  const won =
    !run.victorySecured && run.ante === BALANCE.runAntes && run.blindIndex === 2;
  const endlessComplete =
    run.victorySecured &&
    run.ante === BALANCE.endless.maxAnte &&
    run.blindIndex === 2;
  const next = endlessComplete
    ? { ante: run.ante, blindIndex: run.blindIndex }
    : advance(run.ante, run.blindIndex);
  return {
    cleared: true,
    gameOver: false,
    won,
    endlessComplete,
    earned: {
      reward,
      tagReward,
      phaseCount,
      phases,
      discardCount,
      discards,
      interest: interestGold,
      total,
      letterHandReward: mastery.reward,
    },
    run: {
      ...mastery.run,
      gold: run.gold + total,
      ante: next.ante,
      blindIndex: next.blindIndex,
      pendingClearReward: 0,
      pendingBossReward: blind.kind === 'boss' ? 0 : (run.pendingBossReward ?? 0),
      counters: {
        ...run.counters,
        unusedDiscards: (run.counters.unusedDiscards ?? 0) + discardCount,
      },
      victorySecured: run.victorySecured || won,
    },
  };
}
