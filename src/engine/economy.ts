/**
 * Economy & blind targets (GDD §8.2, §9). Pure math over BALANCE knobs;
 * progression (which blind is next, resolving a cleared blind into gold) lives
 * in progression.ts on top of these.
 */

import { BALANCE } from './balance';
import type { BlindKind } from './types';

/**
 * The score needed to clear a blind (GDD §8.2): per-ante base × kind multiplier
 * (Small ×1 / Big ×1.5 / Boss ×2). Antes past the table (endless mode) keep the
 * curve's final growth ratio.
 */
export function blindTarget(ante: number, kind: BlindKind): number {
  const table = BALANCE.anteBaseTargets;
  let base: number;
  if (ante <= table.length) {
    base = table[ante - 1]!;
  } else {
    const last = table[table.length - 1]!;
    const prev = table[table.length - 2]!;
    base = last * Math.pow(last / prev, ante - table.length);
  }
  return Math.round(base * BALANCE.blindTargetMult[kind]);
}

/** Gold granted for clearing a blind of the given kind (GDD §9.1). */
export function clearReward(kind: BlindKind): number {
  return BALANCE.clearReward[kind];
}

/** Interest: `rate` gold per `per` held, capped (GDD §9.1). */
export function interest(gold: number): number {
  const { per, rate, cap } = BALANCE.interest;
  return Math.min(Math.floor(gold / per) * rate, cap);
}

/** Reroll cost: base + increment per reroll already done this shop (GDD §9.2). */
export function rerollCost(rerollsDone: number): number {
  return BALANCE.shop.rerollBase + BALANCE.shop.rerollIncrement * rerollsDone;
}

/** Sell value of an owned item: half its purchase price, rounded down (GDD §9.1). */
export function sellValue(purchasePrice: number): number {
  return Math.floor(purchasePrice * BALANCE.sellRatio);
}
