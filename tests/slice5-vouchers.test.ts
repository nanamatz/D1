import { describe, it, expect } from 'vitest';
import {
  applyVoucher,
  hasVoucher,
  rerollDiscount,
  interestCap,
  shopItemSlots,
  ALL_VOUCHER_IDS,
  VOUCHER_REGISTRY,
} from '../src/engine/vouchers';
import { newRun } from '../src/engine/run';
import { rerollCost, interest } from '../src/engine/economy';
import { BALANCE } from '../src/engine/balance';

describe('slice5 vouchers — knob bumps applied on purchase (GDD §9.4)', () => {
  it('Extra Hand → hand size +1', () => {
    const r = applyVoucher(newRun('v'), 'extraHand');
    expect(r.handSize).toBe(BALANCE.handSize + 1);
    expect(hasVoucher(r, 'extraHand')).toBe(true);
  });
  it('Extra Discard → discards +1, Overtime → phases +1, Pencil Case → consumable slots +1', () => {
    expect(applyVoucher(newRun('v'), 'extraDiscard').baseDiscards).toBe(BALANCE.discardsPerBlind + 1);
    expect(applyVoucher(newRun('v'), 'overtime').basePhases).toBe(BALANCE.basePhases + 1);
    expect(applyVoucher(newRun('v'), 'pencilCase').consumableSlots).toBe(BALANCE.consumableSlots + 1);
  });
});

describe('slice5 vouchers — economy modifiers read at use sites', () => {
  it("Regular's Discount cuts reroll cost by 2", () => {
    const r = applyVoucher(newRun('v'), 'regularsDiscount');
    expect(rerollDiscount(r)).toBe(2);
    expect(rerollCost(0, rerollDiscount(r))).toBe(BALANCE.shop.rerollBase - 2);
  });
  it('Compound Interest raises the interest cap 5 → 10', () => {
    const r = applyVoucher(newRun('v'), 'compoundInterest');
    expect(interestCap(r)).toBe(10);
    expect(interest(100, interestCap(r))).toBe(10); // uncapped-at-5 now
  });
  it('Wide Shelf adds a shop item slot', () => {
    const r = applyVoucher(newRun('v'), 'wideShelf');
    expect(shopItemSlots(r)).toBe(BALANCE.shop.itemSlots + 1);
  });
});

describe('slice5 vouchers — registry', () => {
  it('registers all nine vouchers with a price', () => {
    expect(ALL_VOUCHER_IDS).toHaveLength(9);
    for (const id of ALL_VOUCHER_IDS) expect(VOUCHER_REGISTRY.get(id)?.price).toBeGreaterThan(0);
  });
});
