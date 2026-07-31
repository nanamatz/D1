/**
 * Economy & blind targets (GDD §8.2, §9). Pure math over BALANCE knobs;
 * progression (which blind is next, resolving a cleared blind into gold) lives
 * in progression.ts on top of these.
 */

import { BALANCE } from './balance';
import {
  pouchDiscardGoldRate,
  pouchDisablesInterest,
  pouchPhaseGoldRate,
  pouchTargetMultiplier,
} from './pouches';
import {
  recordDisablesInterest,
  recordRemovesDraftReward,
  recordTargetMultiplier,
} from './records';
import { interestCap } from './vouchers';
import type { BlindKind, RunState } from './types';

/**
 * The score needed to clear a blind (GDD §8.2): per-ante base × kind multiplier
 * (Small ×1 / Big ×1.5 / Boss ×2). Antes past the table (endless mode) keep the
 * curve's final growth ratio.
 */
export function blindTarget(ante: number, kind: BlindKind): number {
  const table = BALANCE.anteBaseTargets;
  let base: number;
  if (ante < 1) {
    // History Book can push the ante below 1 (feedback 2026-07-28): extrapolate the
    // curve DOWN from the first two antes so a lower ante is genuinely easier, not NaN.
    base = table[0]! * Math.pow(table[0]! / table[1]!, 1 - ante);
  } else if (ante <= table.length) {
    base = table[ante - 1]!;
  } else {
    const last = table[table.length - 1]!;
    const prev = table[table.length - 2]!;
    base = last * Math.pow(last / prev, ante - table.length);
  }
  return Math.round(base * BALANCE.blindTargetMult[kind]);
}

/** Actual target for this run's pouch + cumulative Record modifiers.
 * `extraMultiplier` is the current boss hook, folded in before the final round. */
export function effectiveBlindTarget(
  run: RunState,
  kind: BlindKind,
  extraMultiplier = 1,
): number {
  return Math.round(
    blindTarget(run.ante, kind) *
      recordTargetMultiplier(run, run.ante) *
      pouchTargetMultiplier(run) *
      extraMultiplier,
  );
}

/** Gold granted for clearing a blind of the given kind (GDD §9.1). */
export function clearReward(kind: BlindKind): number {
  return BALANCE.clearReward[kind];
}

/** Red LP and every higher Record remove the Draft clear reward. */
export function effectiveClearReward(run: RunState, kind: BlindKind): number {
  return kind === 'small' && recordRemovesDraftReward(run) ? 0 : clearReward(kind);
}

/** Interest: `rate` gold per `per` held, capped (GDD §9.1). Cap is raised by the
 *  Compound Interest voucher — callers pass the effective cap. */
export function interest(gold: number, cap: number = BALANCE.interest.cap): number {
  const { per, rate } = BALANCE.interest;
  return Math.min(Math.floor(gold / per) * rate, cap);
}

/** Purple Pouch and DVD both force the complete interest stream to zero. */
export function effectiveInterest(run: RunState): number {
  return pouchDisablesInterest(run) || recordDisablesInterest(run)
    ? 0
    : interest(run.gold, interestCap(run));
}

export const remainingPhaseGold = (run: RunState, phasesLeft: number): number =>
  phasesLeft * pouchPhaseGoldRate(run);

export const remainingDiscardGold = (run: RunState, discardsLeft: number): number =>
  discardsLeft * pouchDiscardGoldRate(run);

/** Reroll cost: base + increment per reroll, minus any voucher discount, floored at 0. */
export function rerollCost(rerollsDone: number, discount = 0): number {
  return Math.max(0, BALANCE.shop.rerollBase + BALANCE.shop.rerollIncrement * rerollsDone - discount);
}

/** Sell value of an owned item: half its purchase price, rounded down (GDD §9.1). */
export function sellValue(purchasePrice: number): number {
  return Math.floor(purchasePrice * BALANCE.sellRatio);
}
