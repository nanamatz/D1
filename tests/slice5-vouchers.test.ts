import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { blindTarget, interest, rerollCost } from '../src/engine/economy';
import { newRun } from '../src/engine/run';
import {
  ALL_VOUCHER_IDS,
  BASE_VOUCHER_IDS,
  applyVoucher,
  availableVoucherIds,
  discountedPrice,
  hasVoucher,
  interestCap,
  rerollDiscount,
  shopItemSlots,
  VOUCHER_REGISTRY,
} from '../src/engine/vouchers';

describe('two-tier vouchers — direct resource effects', () => {
  it('stacks hand, discard, phase, and slot upgrades', () => {
    const fresh = newRun('v');
    let run = applyVoucher(fresh, 'memo');
    run = applyVoucher(run, 'notebook');
    run = applyVoucher(run, 'poetryBook');
    run = applyVoucher(run, 'sheetMusic');
    run = applyVoucher(run, 'fourCutPhoto');
    run = applyVoucher(run, 'pictureDiary');
    run = applyVoucher(run, 'zeroScore');
    run = applyVoucher(run, 'kungfuManual');
    expect(run.basePhases).toBe(BALANCE.basePhases + 2);
    expect(run.baseDiscards).toBe(fresh.baseDiscards + 2);
    expect(run.handSize).toBe(BALANCE.handSize + 2);
    expect(run.consumableSlots).toBe(BALANCE.consumableSlots + 1);
    expect(run.jokerSlots).toBe(BALANCE.jokerSlots + 1);
  });

  it('History/Old Book each lower ante, preserve the scheduled blind, and apply their penalties', () => {
    const fresh = newRun('v');
    let run: import('../src/engine/types').RunState = { ...fresh, ante: 5, blindIndex: 2 };
    run = applyVoucher(run, 'historyBook');
    expect(run.blindIndex).toBe(2);
    run = applyVoucher(run, 'oldBook');
    expect(run.ante).toBe(3);
    expect(run.blindIndex).toBe(2); // the already-scheduled Deadline remains scheduled
    expect(run.handSize).toBe(BALANCE.handSize - 1); // History Book −1 hand (per its tooltip)
    expect(run.baseDiscards).toBe(fresh.baseDiscards - 1);
  });

  it('History Book can push the ante to 0 with a valid (easier) target', () => {
    const run = applyVoucher({ ...newRun('v'), ante: 1 }, 'historyBook');
    expect(run.ante).toBe(0); // feedback: ante 1 → 0, not clamped at 1
    // ante 0 Draft must be a real, easier target — not NaN.
    const target = blindTarget(0, 'small');
    expect(Number.isFinite(target)).toBe(true);
    expect(target).toBeGreaterThan(0);
    expect(target).toBeLessThan(blindTarget(1, 'small'));
  });
});

describe('two-tier vouchers — derived economy effects', () => {
  it('stacks the two reroll discounts', () => {
    const run = applyVoucher(applyVoucher(newRun('v'), 'fashionBook'), 'fashionMagazine');
    expect(rerollDiscount(run)).toBe(4);
    expect(rerollCost(0, rerollDiscount(run))).toBe(1);
  });

  it('uses the strongest interest and shop-discount tier', () => {
    let run = applyVoucher(newRun('v'), 'receipt');
    expect(interest(100, interestCap(run))).toBe(10);
    run = applyVoucher(run, 'householdLedger');
    expect(interestCap(run)).toBe(20);
    run = applyVoucher(run, 'newspaper');
    expect(discountedPrice(run, 8)).toBe(6);
    expect(discountedPrice(run, 9)).toBe(6);
    run = applyVoucher(run, 'papyrus');
    expect(discountedPrice(run, 8)).toBe(4);
  });

  it('Catalog and Coupon Book grow the shop to four slots', () => {
    let run = applyVoucher(newRun('v'), 'catalog');
    expect(shopItemSlots(run)).toBe(3);
    run = applyVoucher(run, 'couponBook');
    expect(shopItemSlots(run)).toBe(4);
  });
});

describe('two-tier voucher pool and registry', () => {
  it('registers 16 base and 16 upgraded vouchers', () => {
    expect(ALL_VOUCHER_IDS).toHaveLength(32);
    for (const id of ALL_VOUCHER_IDS) expect(VOUCHER_REGISTRY.get(id)?.price).toBe(10);
  });

  it('places Newspaper before Flyer in the shared voucher order', () => {
    expect(BASE_VOUCHER_IDS.indexOf('newspaper')).toBeLessThan(BASE_VOUCHER_IDS.indexOf('flyer'));
  });

  it('requires profile unlock and the base in this run before an upgrade appears', () => {
    const fresh = newRun('v');
    expect(availableVoucherIds(fresh, new Set(['novel']))).not.toContain('novel');
    const withBase = applyVoucher(fresh, 'storyBook');
    expect(hasVoucher(withBase, 'storyBook')).toBe(true);
    expect(availableVoucherIds(withBase, new Set())).not.toContain('novel');
    expect(availableVoucherIds(withBase, new Set(['novel']))).toContain('novel');
  });
});
