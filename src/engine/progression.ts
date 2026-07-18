/**
 * Blind / ante progression (GDD §8.1). An ante is three blinds — Small → Big →
 * Boss — then the ante rolls over. Clearing a blind pays out the four gold
 * streams (§9.1); missing the target ends the run.
 */

import { BALANCE } from './balance';
import { blindTarget, clearReward, interest } from './economy';
import { hasVoucher, interestCap } from './vouchers';
import type { BlindKind, BlindState, RunState } from './types';

const KINDS = ['small', 'big', 'boss'] as const;

/** The blind kind for a within-ante index (GDD §8.1). */
export function kindForIndex(index: 0 | 1 | 2): BlindKind {
  return KINDS[index];
}

/** The target the run's current blind must beat (GDD §8.2). */
export function currentTarget(run: RunState): number {
  return blindTarget(run.ante, kindForIndex(run.blindIndex));
}

export interface BlindEarnings {
  reward: number;
  phases: number;
  interest: number;
  /** Thrift voucher: gold per unused discard (GDD §9.4) */
  thrift: number;
  total: number;
}

export interface BlindOutcome {
  cleared: boolean;
  gameOver: boolean;
  /** cleared the final chapter's Boss — the run is won (GDD §8.2); endless mode
   *  (planned) will consume `run`/`earned` to continue past this instead */
  won: boolean;
  earned: BlindEarnings;
  /** the run after payout + advancement (unchanged on a miss) */
  run: RunState;
}

const NO_EARNINGS: BlindEarnings = { reward: 0, phases: 0, interest: 0, thrift: 0, total: 0 };

function advance(ante: number, blindIndex: 0 | 1 | 2): { ante: number; blindIndex: 0 | 1 | 2 } {
  if (blindIndex < 2) return { ante, blindIndex: (blindIndex + 1) as 0 | 1 | 2 };
  return { ante: ante + 1, blindIndex: 0 };
}

/**
 * Resolve a finished blind (GDD §7.4 → §9.1). If the final score cleared the
 * target, pay reward + remaining-phase gold + interest and advance; otherwise
 * the run is over.
 */
export function resolveBlind(run: RunState, blind: BlindState, finalScore: number): BlindOutcome {
  if (finalScore < blind.target) {
    return { cleared: false, gameOver: true, won: false, earned: NO_EARNINGS, run };
  }
  const reward = clearReward(blind.kind);
  const phases = (blind.phasesTotal - blind.phasesUsed) * BALANCE.goldPerRemainingPhase;
  const interestGold = interest(run.gold, interestCap(run));
  const thrift = hasVoucher(run, 'thrift')
    ? blind.discardsLeft * BALANCE.voucher.thriftPerDiscard
    : 0;
  const total = reward + phases + interestGold + thrift;
  const next = advance(run.ante, run.blindIndex);
  return {
    cleared: true,
    gameOver: false,
    won: run.ante === BALANCE.runAntes && run.blindIndex === 2,
    earned: { reward, phases, interest: interestGold, thrift, total },
    run: { ...run, gold: run.gold + total, ante: next.ante, blindIndex: next.blindIndex },
  };
}
