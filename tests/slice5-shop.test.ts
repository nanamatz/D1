import { describe, it, expect } from 'vitest';
import { rollShopStock, buyItem, sellJoker, rerollShop } from '../src/engine/shop';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { BALANCE } from '../src/engine/balance';
import type { OwnedJoker, RunState, ShopItem, ShopState } from '../src/engine/types';

const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun('shop'), ...over });
const shopWith = (items: (ShopItem | null)[], rerolls = 0): ShopState => ({ items, rerolls });
const dummyJokers = (n: number): OwnedJoker[] =>
  Array.from({ length: n }, (_, i) => ({ defId: `d${i}`, state: {} }));

describe('slice5 shop — stock roll (GDD §9.2)', () => {
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
      expect(['joker', 'consumable']).toContain(item.kind);
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it('never offers a joker the player already owns', () => {
    const owned = run({ jokers: [{ defId: 'grammarian', state: {} }] });
    for (let i = 0; i < 8; i++) {
      const { items } = rollShopStock(owned, makeRng(`seed${i}`));
      for (const it of items) if (it?.kind === 'joker') expect(it.id).not.toBe('grammarian');
    }
  });
});

describe('slice5 shop — buy', () => {
  const shop = shopWith([
    { kind: 'joker', id: 'grammarian', price: 9 },
    { kind: 'consumable', id: 'magnifier', price: 3 },
  ]);

  it('buys a joker: gold spent, joker owned, slot emptied', () => {
    const res = buyItem(run({ gold: 20 }), shop, 0);
    expect(res.ok).toBe(true);
    expect(res.run.gold).toBe(11);
    expect(res.run.jokers.map((j) => j.defId)).toContain('grammarian');
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

  it('refuses a consumable when consumable slots are full', () => {
    const full = run({ gold: 99, consumables: ['magnifier', 'magnifier'] }); // slots = 2
    expect(buyItem(full, shop, 1).ok).toBe(false);
  });
});

describe('slice5 shop — sell & reroll', () => {
  it('sells a joker for half its price (GDD §9.1)', () => {
    const r = run({ gold: 0, jokers: [{ defId: 'grammarian', state: {} }] });
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
});
