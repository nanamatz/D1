import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { rollShopStock, rerollShop, buyVoucher, rollVoucherOffer } from '../src/engine/shop';
import { makeRng } from '../src/engine/rng';
import type { RunState, VoucherId } from '../src/engine/types';

const richRun = (): RunState => ({ ...newRun('c'), gold: 100 });

describe('playtest-03 C — voucher shop rules', () => {
  it('rollVoucherOffer never offers an already-owned voucher (reappearance)', () => {
    const run: RunState = { ...newRun('c'), vouchers: ['extraHand'] as VoucherId[] };
    for (let i = 0; i < 20; i++) {
      expect(rollVoucherOffer(run, makeRng(`v${i}`))).not.toBe('extraHand');
    }
  });

  it('reroll never refreshes the voucher slot', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'extraHand' };
    const shop = rollShopStock(run, makeRng('s'));
    expect(shop.voucher).toBe('extraHand');
    let r = { run, shop };
    for (let i = 0; i < 5; i++) {
      const res = rerollShop(r.run, r.shop, makeRng(`r${i}`));
      r = { run: res.run, shop: res.shop };
    }
    expect(r.shop.voucher).toBe('extraHand'); // untouched by 5 rerolls
  });

  it('one voucher purchase per chapter — buying locks the slot', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'extraHand', voucherLocked: false };
    const shop = rollShopStock(run, makeRng('s'));
    const res = buyVoucher(run, shop);
    expect(res.ok).toBe(true);
    expect(res.run.voucherLocked).toBe(true);
    expect(res.shop.voucher).toBeNull();

    // Subsequent shops this chapter show a greyed (null) slot, and a second
    // purchase is refused even if a voucher is forced into the slot.
    expect(rollShopStock(res.run, makeRng('s2')).voucher).toBeNull();
    expect(buyVoucher(res.run, { ...shop, voucher: 'thrift' }).ok).toBe(false);
  });

  it('an unlocked chapter shows its fixed offer', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'thrift', voucherLocked: false };
    expect(rollShopStock(run, makeRng('s')).voucher).toBe('thrift');
  });
});
