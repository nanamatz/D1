import { describe, it, expect } from 'vitest';
import {
  rollShopStock,
  buyItem,
  sellJoker,
  rerollShop,
  buyVoucher,
  prepareShop,
} from '../src/engine/shop';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { BALANCE } from '../src/engine/balance';
import type { OwnedJoker, RunState, ShopItem, ShopState, VoucherId } from '../src/engine/types';

const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun('shop'), ...over });
const shopWith = (
  items: (ShopItem | null)[],
  rerolls = 0,
  voucher: VoucherId | null = null,
): ShopState => ({ items, voucher, bonusVoucher: null, packs: [], rerolls });
const dummyJokers = (n: number): OwnedJoker[] =>
  Array.from({ length: n }, (_, i) => ({ defId: `d${i}`, state: {} }));

describe('slice5 shop — stock roll (GDD §9.2)', () => {
  it('uses the Balatro-derived item-family weights', () => {
    expect(BALANCE.shop.itemWeights).toEqual({
      joker: 20,
      tile: 4,
      consumable: 4,
      punctuation: 4,
      gambler: 2,
    });
  });

  it('rolls those weights when all four item types are unlocked', () => {
    const counts = { joker: 0, tile: 0, consumable: 0, punctuation: 0 };
    const unlocked = run({ vouchers: ['enKoDictionary'], shopsVisited: 1 });
    for (let i = 0; i < 5_000; i++) {
      for (const item of rollShopStock(unlocked, makeRng(`weights-${i}`)).items) {
        if (item) counts[item.kind]++;
      }
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    expect(counts.joker / total).toBeCloseTo(20 / 32, 1);
    expect(counts.tile / total).toBeCloseTo(4 / 32, 1);
    expect(counts.consumable / total).toBeCloseTo(4 / 32, 1);
    expect(counts.punctuation / total).toBeCloseTo(4 / 32, 1);
  });

  it('guarantees a Basic Charm Pack only in the first real Stationery Shop', () => {
    const first = prepareShop(run(), makeRng('first-shop'));
    expect(first.shop.packs).toContainEqual(expect.objectContaining({
      type: 'joker',
      size: 'normal',
    }));
    expect(first.run.shopsVisited).toBe(1);

    const laterCanMiss = Array.from({ length: 30 }, (_, i) =>
      rollShopStock(first.run, makeRng(`later-shop-${i}`)),
    ).some((stock) => !stock.packs.some((pack) =>
      pack?.type === 'joker' && pack.size === 'normal',
    ));
    expect(laterCanMiss).toBe(true);
  });

  it('fills the item slots and is deterministic per seed', () => {
    const a = rollShopStock(run(), makeRng('x'));
    const b = rollShopStock(run(), makeRng('x'));
    expect(a.items.length).toBe(BALANCE.shop.itemSlots);
    expect(a).toEqual(b);
    expect(a.rerolls).toBe(0);
  });

  it('each stocked item has a valid kind and price', () => {
    const { items } = rollShopStock(run(), makeRng('y'));
    for (const item of items) {
      if (!item) continue;
      expect(['joker', 'consumable', 'punctuation', 'tile']).toContain(item.kind);
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it('never offers a joker the player already owns', () => {
    const owned = run({ jokers: [{ defId: 'hypocrite', state: {} }] });
    for (let i = 0; i < 8; i++) {
      const { items } = rollShopStock(owned, makeRng(`seed${i}`));
      for (const it of items) if (it?.kind === 'joker') expect(it.id).not.toBe('hypocrite');
    }
  });

  it('never repeats an item id or pack type/size pair in one shop', () => {
    for (let i = 0; i < 40; i++) {
      const stock = rollShopStock(run(), makeRng(`unique-${i}`));
      const itemKeys = stock.items
        .filter((item): item is ShopItem => item !== null)
        .map((item) => item.kind === 'tile' ? `tile:${item.tile.id}` : `${item.kind}:${item.id}`);
      const packKeys = stock.packs
        .flatMap((pack) => pack ? [`${pack.type}:${pack.size}`] : []);
      expect(new Set(itemKeys).size).toBe(itemKeys.length);
      expect(new Set(packKeys).size).toBe(packKeys.length);
    }
  });
});

describe('slice5 shop — pack art variant (cosmetic, seeded)', () => {
  it('every stocked pack carries an in-range artVariant for its size', () => {
    for (let i = 0; i < 12; i++) {
      const { packs } = rollShopStock(run(), makeRng(`pack${i}`));
      for (const p of packs) {
        if (!p) continue;
        const count = BALANCE.pack.artVariants[p.type][p.size];
        expect(p.artVariant).toBeGreaterThanOrEqual(0);
        expect(p.artVariant).toBeLessThan(count);
        expect(Number.isInteger(p.artVariant)).toBe(true);
      }
    }
  });

  it('the same seed reproduces the same pack art variants', () => {
    const a = rollShopStock(run(), makeRng('same'));
    const b = rollShopStock(run(), makeRng('same'));
    expect(a.packs.map((p) => p?.artVariant)).toEqual(b.packs.map((p) => p?.artVariant));
  });
});

describe('slice5 shop — buy', () => {
  const shop = shopWith([
    { kind: 'joker', id: 'hypocrite', price: 9 },
    { kind: 'consumable', id: 'magnifier', price: 3 },
  ]);

  it('buys a joker: gold spent, joker owned, slot emptied', () => {
    const res = buyItem(run({ gold: 20 }), shop, 0);
    expect(res.ok).toBe(true);
    expect(res.run.gold).toBe(11);
    expect(res.run.jokers.map((j) => j.defId)).toContain('hypocrite');
    expect(res.shop.items[0]).toBeNull();
    expect(res.shop.items[1]).not.toBeNull(); // other slot untouched
  });

  it('buys a consumable into a free slot', () => {
    const res = buyItem(run({ gold: 20, consumables: [] }), shop, 1);
    expect(res.ok).toBe(true);
    expect(res.run.consumables).toContain('magnifier');
    expect(res.run.gold).toBe(17);
  });

  it('refuses when gold is insufficient (unchanged)', () => {
    const r = run({ gold: 2 });
    const res = buyItem(r, shop, 0);
    expect(res.ok).toBe(false);
    expect(res.run).toBe(r);
  });

  it('refuses a joker when joker slots are full', () => {
    const full = run({ gold: 99, jokers: dummyJokers(BALANCE.jokerSlots) });
    expect(buyItem(full, shop, 0).ok).toBe(false);
  });

  it('refuses a stale joker offer when that Emoji Tile is already owned', () => {
    const owned = run({
      gold: 99,
      jokers: [{ defId: 'hypocrite', edition: 'base', state: {} }],
    });
    const result = buyItem(owned, shop, 0);
    expect(result.ok).toBe(false);
    expect(result.run).toBe(owned);
  });

  it('refuses a consumable when consumable slots are full', () => {
    const full = run({ gold: 99, consumables: ['magnifier', 'magnifier'] }); // slots = 2
    expect(buyItem(full, shop, 1).ok).toBe(false);
  });
});

describe('slice5 shop — sell & reroll', () => {
  it('sells a joker for half its price (GDD §9.1)', () => {
    const r = run({ gold: 0, jokers: [{ defId: 'hypocrite', state: {} }] });
    const res = sellJoker(r, 0);
    expect(res.ok).toBe(true);
    expect(res.run.gold).toBe(4); // rare 9 → floor(9·0.5)
    expect(res.run.jokers).toHaveLength(0);
  });

  it('reroll costs base then escalates, regenerating stock (GDD §9.2)', () => {
    const shop = shopWith([{ kind: 'consumable', id: 'magnifier', price: 3 }], 0);
    const res = rerollShop(run({ gold: 10 }), shop, makeRng('r'));
    expect(res.ok).toBe(true);
    expect(res.run.gold).toBe(5); // base reroll 5
    expect(res.shop.rerolls).toBe(1);
  });

  it('reroll refused when gold is insufficient', () => {
    const shop = shopWith([], 0);
    const r = run({ gold: 1 });
    expect(rerollShop(r, shop, makeRng('r')).ok).toBe(false);
  });

  it('buys the offered voucher: gold spent, effect applied, slot cleared', () => {
    const shop = shopWith([], 0, 'fourCutPhoto');
    const res = buyVoucher(run({ gold: 20 }), shop);
    expect(res.ok).toBe(true);
    expect(res.run.vouchers).toContain('fourCutPhoto');
    expect(res.run.handSize).toBe(BALANCE.handSize + 1);
    expect(res.shop.voucher).toBeNull();
  });
});
