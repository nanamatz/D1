/**
 * Shop (GDD §9.2): item-slot stock generation, buy, sell, reroll. Pure and
 * seeded — the stock is reproducible from the run seed + reroll RNG. Packs and
 * vouchers are separate slots (deferred); this covers the item slots + economy.
 */

import { BALANCE } from './balance';
import { ALL_JOKERS, JOKER_REGISTRY } from './jokers';
import { rerollCost, sellValue } from './economy';
import type { Rng } from './rng';
import type { ConsumableId, OwnedJoker, RunState, ShopItem, ShopState } from './types';

/** Consumables that actually have an effect today (grows as they're built). */
const CONSUMABLE_POOL: readonly ConsumableId[] = ['magnifier'];

/** All items the shop could offer this run, minus jokers already owned. */
function buildPool(run: RunState): ShopItem[] {
  const owned = new Set(run.jokers.map((j) => j.defId));
  const jokers: ShopItem[] = ALL_JOKERS.filter((j) => !owned.has(j.id)).map((j) => ({
    kind: 'joker',
    id: j.id,
    price: BALANCE.jokerPrice[j.rarity],
  }));
  const consumables: ShopItem[] = CONSUMABLE_POOL.map((id) => ({
    kind: 'consumable',
    id,
    price: BALANCE.consumablePrice,
  }));
  return [...jokers, ...consumables];
}

/** Roll a fresh stock into the item slots (distinct items; null if pool is short). */
export function rollShopStock(run: RunState, rng: Rng): ShopState {
  const shuffled = rng.shuffle(buildPool(run));
  const items: (ShopItem | null)[] = [];
  for (let i = 0; i < BALANCE.shop.itemSlots; i++) items.push(shuffled[i] ?? null);
  return { items, rerolls: 0 };
}

export interface BuyResult {
  run: RunState;
  shop: ShopState;
  ok: boolean;
}

/** Buy the item in slot `index`, respecting gold and joker/consumable slot caps. */
export function buyItem(run: RunState, shop: ShopState, index: number): BuyResult {
  const item = shop.items[index];
  const fail: BuyResult = { run, shop, ok: false };
  if (!item || run.gold < item.price) return fail;

  let nextRun: RunState;
  if (item.kind === 'joker') {
    if (run.jokers.length >= BALANCE.jokerSlots) return fail;
    nextRun = {
      ...run,
      gold: run.gold - item.price,
      jokers: [...run.jokers, { defId: item.id, state: {} }],
    };
  } else {
    if (run.consumables.length >= run.consumableSlots) return fail;
    nextRun = { ...run, gold: run.gold - item.price, consumables: [...run.consumables, item.id] };
  }

  const items = shop.items.slice();
  items[index] = null; // sold out of the slot
  return { run: nextRun, shop: { ...shop, items }, ok: true };
}

export interface SellResult {
  run: RunState;
  ok: boolean;
}

/** Sell the owned joker at `index` for half its purchase price (GDD §9.1). */
export function sellJoker(run: RunState, index: number): SellResult {
  const owned: OwnedJoker | undefined = run.jokers[index];
  if (!owned) return { run, ok: false };
  const def = JOKER_REGISTRY.get(owned.defId);
  const value = sellValue(def ? BALANCE.jokerPrice[def.rarity] : 0);
  const jokers = run.jokers.filter((_, i) => i !== index);
  return { run: { ...run, gold: run.gold + value, jokers }, ok: true };
}

/** Reroll the item slots for the escalating cost (GDD §9.2). */
export function rerollShop(run: RunState, shop: ShopState, rng: Rng): BuyResult {
  const cost = rerollCost(shop.rerolls);
  if (run.gold < cost) return { run, shop, ok: false };
  const nextRun = { ...run, gold: run.gold - cost };
  const rolled = rollShopStock(nextRun, rng);
  return { run: nextRun, shop: { items: rolled.items, rerolls: shop.rerolls + 1 }, ok: true };
}
