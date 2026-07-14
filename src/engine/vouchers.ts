/**
 * Vouchers (GDD §9.4) — single-tier, 9. Each turns a system knob into
 * merchandise. Direct knobs (hand/exchanges/phases/consumable slots) are bumped
 * on purchase; economy modifiers (reroll discount, interest cap, thrift, wide
 * shelf, connoisseur) are read from run.vouchers at their use sites.
 */

import { BALANCE } from './balance';
import type { RunState, VoucherId } from './types';

export interface VoucherDef {
  id: VoucherId;
  nameEn: string;
  nameKo: string;
  emoji: string;
  price: number;
}

const VOUCHERS: readonly VoucherDef[] = [
  { id: 'extraHand', nameEn: 'Extra Hand', nameKo: '여분의 손', emoji: '✋', price: BALANCE.voucherPrice.extraHand! },
  { id: 'recycling', nameEn: 'Recycling', nameKo: '재활용', emoji: '♻️', price: BALANCE.voucherPrice.recycling! },
  { id: 'overtime', nameEn: 'Overtime', nameKo: '초과근무', emoji: '⏰', price: BALANCE.voucherPrice.overtime! },
  { id: 'regularsDiscount', nameEn: "Regular's Discount", nameKo: '단골 할인', emoji: '🏷️', price: BALANCE.voucherPrice.regularsDiscount! },
  { id: 'compoundInterest', nameEn: 'Compound Interest', nameKo: '복리', emoji: '📈', price: BALANCE.voucherPrice.compoundInterest! },
  { id: 'thrift', nameEn: 'Thrift', nameKo: '절약', emoji: '🪙', price: BALANCE.voucherPrice.thrift! },
  { id: 'wideShelf', nameEn: 'Wide Shelf', nameKo: '넓은 선반', emoji: '🗄️', price: BALANCE.voucherPrice.wideShelf! },
  { id: 'connoisseur', nameEn: 'Connoisseur', nameKo: '감식가', emoji: '🧐', price: BALANCE.voucherPrice.connoisseur! },
  { id: 'pencilCase', nameEn: 'Pencil Case', nameKo: '필통', emoji: '✏️', price: BALANCE.voucherPrice.pencilCase! },
];

export const VOUCHER_REGISTRY: ReadonlyMap<VoucherId, VoucherDef> = new Map(VOUCHERS.map((v) => [v.id, v]));
export const ALL_VOUCHER_IDS: readonly VoucherId[] = VOUCHERS.map((v) => v.id);

export const hasVoucher = (run: RunState, id: VoucherId): boolean => run.vouchers.includes(id);

/** Apply a voucher: permanent knob bumps + record ownership. */
export function applyVoucher(run: RunState, id: VoucherId): RunState {
  let r = run;
  switch (id) {
    case 'extraHand':
      r = { ...r, handSize: r.handSize + 1 };
      break;
    case 'recycling':
      r = { ...r, baseExchanges: r.baseExchanges + 1 };
      break;
    case 'overtime':
      r = { ...r, basePhases: r.basePhases + 1 };
      break;
    case 'pencilCase':
      r = { ...r, consumableSlots: r.consumableSlots + 1 };
      break;
    default:
      break; // read at use sites
  }
  return { ...r, vouchers: [...r.vouchers, id] };
}

// ----- derived economy effects (read from run.vouchers) -----
export const rerollDiscount = (run: RunState): number =>
  hasVoucher(run, 'regularsDiscount') ? BALANCE.voucher.rerollDiscount : 0;

export const interestCap = (run: RunState): number =>
  hasVoucher(run, 'compoundInterest') ? BALANCE.voucher.interestCap : BALANCE.interest.cap;

export const shopItemSlots = (run: RunState): number =>
  BALANCE.shop.itemSlots + (hasVoucher(run, 'wideShelf') ? BALANCE.voucher.wideShelfSlots : 0);

export const packEnhanceChance = (run: RunState): number =>
  hasVoucher(run, 'connoisseur') ? BALANCE.packEnhanceChance.connoisseur : BALANCE.packEnhanceChance.base;
