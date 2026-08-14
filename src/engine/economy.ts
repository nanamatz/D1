/**
 * Economy & blind targets (GDD §8.2, §9). Pure math over BALANCE knobs;
 * progression (which blind is next, resolving a cleared blind into gold) lives
 * in progression.ts on top of these.
 */

import { BALANCE } from './balance';
import { BOSS_REGISTRY } from './bosses';
import { isGamblerId } from './gamblerIds';
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
import { discountedPrice, emojiTileShopPrice, interestCap } from './vouchers';
import type { BlindKind, ConsumableId, JokerEdition, RunState, Tile } from './types';

/**
 * The score needed to clear a blind (GDD §8.2): per-ante base × kind multiplier
 * (Small ×1 / Big ×1.5 / Boss ×2). Chapters 9–38 use the endless curve; Chapter
 * 39 is intentionally unavailable because its target exceeds Number's range.
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
    if (ante > BALANCE.endless.maxAnte) {
      throw new RangeError(`chapter ${ante} exceeds the endless limit`);
    }
    const last = table[table.length - 1]!;
    const c = ante - table.length;
    const d = 1 + BALANCE.endless.exponentGrowth * c;
    const inner =
      BALANCE.endless.baseFactor + Math.pow(BALANCE.endless.growth * c, d);
    const log10 = Math.log10(last) + c * Math.log10(inner);
    const raw = Math.pow(10, log10);
    const unit = Math.pow(
      10,
      Math.floor(Math.log10(raw)) - BALANCE.endless.significantDigits + 1,
    );
    base = Math.floor(raw / unit) * unit;
  }
  const target = Math.round(base * BALANCE.blindTargetMult[kind]);
  if (!Number.isFinite(target)) throw new RangeError(`chapter ${ante} target overflow`);
  return target;
}

/** Actual target for this run's pouch + cumulative Record modifiers.
 * `extraMultiplier` is the current boss hook, folded in before the final round. */
export function effectiveBlindTarget(
  run: RunState,
  kind: BlindKind,
  extraMultiplier = 1,
): number {
  const currentKind = (['small', 'big', 'boss'] as const)[run.blindIndex];
  const skipMultiplier = kind === currentKind ? run.nextBlindBonus.targetMultiplier : 1;
  const target = Math.round(
    blindTarget(run.ante, kind) *
      recordTargetMultiplier(run, run.ante) *
      pouchTargetMultiplier(run) *
      extraMultiplier *
      skipMultiplier,
  );
  if (!Number.isFinite(target)) throw new RangeError(`chapter ${run.ante} target overflow`);
  return target;
}

/** Gold granted for clearing a blind of the given kind (GDD §9.1). */
export function clearReward(kind: BlindKind): number {
  return BALANCE.clearReward[kind];
}

/** Red LP and every higher Record remove the Draft clear reward. */
export function effectiveClearReward(
  run: RunState,
  kind: BlindKind,
  bossId: string | null = null,
  includePending = true,
): number {
  const bossReward = bossId ? BOSS_REGISTRY.get(bossId)?.clearReward : undefined;
  const base = bossReward !== undefined
    ? bossReward
    : kind === 'small' && recordRemovesDraftReward(run) ? 0 : clearReward(kind);
  const currentKind = (['small', 'big', 'boss'] as const)[run.blindIndex];
  const nextBlindReward = kind === currentKind
    ? (run.nextBlindBonus.clearRewardBonus ?? 0)
    : 0;
  return base + nextBlindReward +
    (includePending ? run.pendingClearReward : 0) +
    (kind === 'boss' ? (run.pendingBossReward ?? 0) : 0);
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

/** Half the supplied current price, rounded down, with the shared $1 floor. */
export function sellValue(purchasePrice: number): number {
  return Math.max(1, Math.floor(purchasePrice * BALANCE.sellRatio));
}

export const editionSurcharge = (edition: JokerEdition = 'base'): number =>
  BALANCE.jokerEditionPrice[edition];

/** Current shop price, including edition, active discounts, and Carte Blanche. */
export function emojiTileBuyPrice(
  run: RunState,
  basePrice: number,
  edition: JokerEdition = 'base',
): number {
  return emojiTileShopPrice(
    run,
    discountedPrice(run, basePrice + editionSurcharge(edition)),
  );
}

export const tileBuyPrice = (run: RunState, tile: Tile): number =>
  discountedPrice(run, BALANCE.tilePrice + editionSurcharge(tile.edition ?? 'base'));

export const consumableBasePrice = (id: ConsumableId): number =>
  isGamblerId(id) ? BALANCE.gamblerPrice : BALANCE.consumablePrice;

export const consumableBuyPrice = (run: RunState, id: ConsumableId): number =>
  discountedPrice(run, consumableBasePrice(id));

export const emojiTileSellValue = (
  run: RunState,
  basePrice: number,
  edition: JokerEdition = 'base',
  bonus = 0,
): number => {
  const adjusted = sellValue(emojiTileBuyPrice(run, basePrice, edition));
  if (edition === 'base') return adjusted + bonus;
  const base = sellValue(emojiTileBuyPrice(run, basePrice));
  return Math.max(adjusted, base + BALANCE.minimumEditionSellBonus) + bonus;
};

export const consumableSellValue = (run: RunState, id: ConsumableId): number =>
  sellValue(consumableBuyPrice(run, id));
