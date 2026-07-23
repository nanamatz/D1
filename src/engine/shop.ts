/**
 * Shop (GDD §9.2): item-slot stock generation, buy, sell, reroll. Pure and
 * seeded — the stock is reproducible from the run seed + reroll RNG. Packs and
 * vouchers are separate slots (deferred); this covers the item slots + economy.
 */

import { BALANCE } from './balance';
import { ALL_JOKERS, JOKER_REGISTRY } from './jokers';
import { rerollCost, sellValue } from './economy';
import {
  ALL_VOUCHER_IDS,
  VOUCHER_REGISTRY,
  applyVoucher,
  rerollDiscount,
  shopItemSlots,
} from './vouchers';
import type { Rng } from './rng';
import type {
  ConsumableId,
  OwnedJoker,
  PackSize,
  PackSlot,
  PackType,
  RunState,
  ShopItem,
  ShopState,
  VoucherId,
} from './types';

/** Consumables that actually have an effect today (grows as they're built). */
const CONSUMABLE_POOL: readonly ConsumableId[] = ['magnifier'];
const PACK_TYPES: readonly PackType[] = ['pattern', 'joker', 'consumable', 'tile'];
const PACK_SIZES: readonly PackSize[] = ['normal', 'jumbo', 'mega'];

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

function rollItems(run: RunState, rng: Rng): (ShopItem | null)[] {
  const shuffled = rng.shuffle(buildPool(run));
  const items: (ShopItem | null)[] = [];
  for (let i = 0; i < shopItemSlots(run); i++) items.push(shuffled[i] ?? null); // Wide Shelf +1
  return items;
}

/**
 * Roll one extra item for a newly-opened slot (Wide Shelf, playtest-04 B-2),
 * avoiding items already on the shelf. Lets the +1 slot fill immediately in the
 * same shop visit without re-rolling the existing (possibly wanted) items.
 */
export function rollExtraItem(
  run: RunState,
  existing: readonly (ShopItem | null)[],
  rng: Rng,
): ShopItem | null {
  const shown = new Set(existing.filter((it): it is ShopItem => !!it).map((it) => `${it.kind}:${it.id}`));
  const pool = buildPool(run).filter((it) => !shown.has(`${it.kind}:${it.id}`));
  return pool.length ? rng.shuffle(pool)[0]! : null;
}

/**
 * Roll the next chapter's voucher offer (playtest-03 C): a not-yet-owned voucher.
 * Purchased vouchers are in run.vouchers and thus never reappear; unpurchased
 * ones stay in the pool and may reappear in a later chapter.
 */
export function rollVoucherOffer(run: RunState, rng: Rng): VoucherId | null {
  const available = ALL_VOUCHER_IDS.filter((id) => !run.vouchers.includes(id));
  return available.length ? rng.shuffle(available)[0]! : null;
}

/** Weighted pick from a list of ids using a {id: weight} table. */
function weightedPick<T extends string>(ids: readonly T[], weights: Record<string, number>, rng: Rng): T {
  const total = ids.reduce((s, id) => s + (weights[id] ?? 0), 0);
  let r = rng.next() * total;
  for (const id of ids) {
    r -= weights[id] ?? 0;
    if (r < 0) return id;
  }
  return ids[ids.length - 1]!;
}

/** Each pack slot rolls an independent type × size (Mega/Jumbo rarer). */
function rollPacks(rng: Rng): (PackSlot | null)[] {
  const packs: (PackSlot | null)[] = [];
  for (let i = 0; i < BALANCE.shop.packSlots; i++) {
    const size = weightedPick(PACK_SIZES, BALANCE.pack.sizeWeights, rng);
    const type = weightedPick(PACK_TYPES, BALANCE.pack.typeWeights, rng);
    packs.push({
      type,
      size,
      // cosmetic-only, but seeded so a run reproduces its shop art exactly.
      artVariant: rng.int(BALANCE.pack.artVariants[type][size]),
    });
  }
  return packs;
}

/**
 * Roll a fresh shop: item + pack slots re-roll every visit, but the voucher slot
 * is FIXED per chapter — it shows run.voucherOffer, greyed out (null) once a
 * voucher has been bought this chapter (playtest-03 C). Reroll never touches it.
 */
export function rollShopStock(run: RunState, rng: Rng): ShopState {
  return {
    items: rollItems(run, rng),
    voucher: run.voucherLocked ? null : run.voucherOffer,
    packs: rollPacks(rng),
    rerolls: 0,
  };
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

/**
 * Buy the offered voucher: apply its effect + record ownership (GDD §9.4). Only
 * ONE voucher purchase per chapter (playtest-03 C) — locks the slot until the
 * next chapter's shop.
 */
export function buyVoucher(run: RunState, shop: ShopState): BuyResult {
  const id = shop.voucher;
  if (!id || run.voucherLocked) return { run, shop, ok: false };
  const def = VOUCHER_REGISTRY.get(id);
  if (!def || run.gold < def.price) return { run, shop, ok: false };
  const nextRun = applyVoucher({ ...run, gold: run.gold - def.price, voucherLocked: true }, id);
  return { run: nextRun, shop: { ...shop, voucher: null }, ok: true };
}

/** Reroll the item slots only, for the escalating (voucher-discounted) cost (GDD §9.2). */
export function rerollShop(run: RunState, shop: ShopState, rng: Rng): BuyResult {
  const cost = rerollCost(shop.rerolls, rerollDiscount(run));
  if (run.gold < cost) return { run, shop, ok: false };
  const nextRun = { ...run, gold: run.gold - cost };
  return {
    run: nextRun,
    shop: { ...shop, items: rollItems(nextRun, rng), rerolls: shop.rerolls + 1 },
    ok: true,
  };
}
