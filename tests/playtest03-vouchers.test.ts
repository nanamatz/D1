import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { rollShopStock, rerollShop, buyVoucher, rollVoucherOffer } from '../src/engine/shop';
import { makeRng } from '../src/engine/rng';
import type { Rng } from '../src/engine/rng';
import type { RunState, VoucherId } from '../src/engine/types';

const richRun = (): RunState => ({ ...newRun('c'), gold: 100 });
const preferVoucher = (id: VoucherId): Rng => ({
  next: () => 0,
  int: () => 0,
  shuffle: <T>(items: readonly T[]): T[] =>
    items.slice().sort((a, b) => Number(String(b) === id) - Number(String(a) === id)),
});

describe('playtest-03 C — voucher shop rules', () => {
  it('rollVoucherOffer never offers an already-owned voucher (reappearance)', () => {
    const run: RunState = { ...newRun('c'), vouchers: ['storyBook'] as VoucherId[] };
    for (let i = 0; i < 20; i++) {
      expect(rollVoucherOffer(run, makeRng(`v${i}`))).not.toBe('storyBook');
    }
  });

  it('reroll never refreshes the voucher slot', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'storyBook' };
    const shop = rollShopStock(run, makeRng('s'));
    expect(shop.voucher).toBe('storyBook');
    let r = { run, shop };
    for (let i = 0; i < 5; i++) {
      const res = rerollShop(r.run, r.shop, makeRng(`r${i}`));
      r = { run: res.run, shop: res.shop };
    }
    expect(r.shop.voucher).toBe('storyBook'); // untouched by 5 rerolls
  });

  it('one voucher purchase per chapter — buying locks the slot', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'storyBook', voucherLocked: false };
    const shop = rollShopStock(run, makeRng('s'));
    const res = buyVoucher(run, shop);
    expect(res.ok).toBe(true);
    expect(res.run.voucherLocked).toBe(true);
    expect(res.shop.voucher).toBeNull();

    // Subsequent shops this chapter show a greyed (null) slot, and a second
    // purchase is refused even if a voucher is forced into the slot.
    expect(rollShopStock(res.run, makeRng('s2')).voucher).toBeNull();
    expect(buyVoucher(res.run, { ...shop, voucher: 'poetryBook' }).ok).toBe(false);
  });

  it('an unlocked chapter shows its fixed offer', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'poetryBook', voucherLocked: false };
    expect(rollShopStock(run, makeRng('s')).voucher).toBe('poetryBook');
  });

  it('keeps a base voucher upgrade out of the immediately following restock', () => {
    const run: RunState = { ...richRun(), voucherOffer: 'historyBook' };
    const bought = buyVoucher(run, rollShopStock(run, makeRng('history-shop')));
    const unlocked = new Set<VoucherId>(['oldBook']);

    expect(bought.run.voucherBasesBoughtThisChapter).toEqual(['historyBook']);
    expect(rollVoucherOffer(bought.run, preferVoucher('oldBook'), unlocked)).not.toBe('oldBook');
    expect(rollVoucherOffer(
      { ...bought.run, voucherBasesBoughtThisChapter: [] },
      preferVoucher('oldBook'),
      unlocked,
    )).toBe('oldBook');
  });
});
