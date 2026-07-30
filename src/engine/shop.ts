/**
 * Shop (GDD §9.2): item-slot stock generation, buy, sell, reroll. Pure and
 * seeded — the stock is reproducible from the run seed + reroll RNG. Packs and
 * vouchers are separate slots (deferred); this covers the item slots + economy.
 */

import { BALANCE } from './balance';
import { JOKER_REGISTRY } from './jokers';
import { sampleJokerDefs } from './offers';
import { rerollCost, sellValue } from './economy';
import { rollJokerEdition } from './editions';
import { CONSTELLATION_POOL, rollTile, FABLE_POOL } from './packs';
import {
  CONSUMABLE_PATTERN,
  VOUCHER_REGISTRY,
  applyVoucher,
  availableVoucherIds,
  canAddJoker,
  constellationShopWeight,
  discountedPrice,
  emojiTileShopPrice,
  fableShopWeight,
  rerollDiscount,
  shopSellsTiles,
  shopTilesCanBeEnhanced,
  shopItemSlots,
} from './vouchers';
import type { Rng } from './rng';
import type {
  OwnedJoker,
  PackSize,
  PackSlot,
  PackType,
  RunState,
  ShopItem,
  ShopState,
  VoucherId,
} from './types';

const PACK_TYPES: readonly PackType[] = ['pattern', 'joker', 'consumable', 'tile', 'ink'];
const PACK_SIZES: readonly PackSize[] = ['normal', 'jumbo', 'mega'];

type ItemKind = ShopItem['kind'];
type ItemPools = Record<ItemKind, ShopItem[]>;

/** All items the shop could offer this run, grouped so pool size cannot skew type odds. */
function buildPools(run: RunState, rng: Rng): ItemPools {
  // Rarity-weighted, no-duplicate joker candidates via the shared offer pool
  // (C-1/C-2). A bounded sample (slots + spare, capped by the pool) keeps the
  // joker : Fable : Constellation : tile type-mix balanced while respecting the
  // rarity odds — listing every joker once would both ignore rarity and flood the
  // pool. Legendary never appears (weight 0); a fully-owned pool yields none.
  const jokerCount = shopItemSlots(run) + 2;
  const jokers: ShopItem[] = sampleJokerDefs(run, jokerCount, rng).map((j) => ({
    kind: 'joker',
    id: j.id,
    edition: rollJokerEdition(run, rng),
    price: emojiTileShopPrice(run, discountedPrice(run, BALANCE.jokerPrice[j.rarity])),
  }));
  const consumables: ShopItem[] = FABLE_POOL.map((id) => ({
    kind: 'consumable',
    id,
    price: discountedPrice(run, BALANCE.consumablePrice),
  }));
  const punctuation: ShopItem[] = CONSTELLATION_POOL.map((id) => ({
    kind: 'punctuation',
    id,
    pattern: CONSUMABLE_PATTERN[id]!,
    price: discountedPrice(run, BALANCE.consumablePrice),
  }));
  const tiles: ShopItem[] = shopSellsTiles(run)
    ? Array.from({ length: 4 }, (_, i) => ({
        kind: 'tile' as const,
        tile: rollTile(run, rng, i, shopTilesCanBeEnhanced(run)),
        price: discountedPrice(run, BALANCE.tilePrice),
      }))
    : [];
  return { joker: jokers, tile: tiles, consumable: consumables, punctuation };
}

function kindWeight(run: RunState, kind: ItemKind): number {
  const base = BALANCE.shop.itemWeights[kind];
  if (kind === 'consumable') return base * fableShopWeight(run);
  if (kind === 'punctuation') return base * constellationShopWeight(run);
  return base;
}

function drawItem(run: RunState, pools: ItemPools, rng: Rng): ShopItem | null {
  const kinds = (Object.keys(pools) as ItemKind[]).filter((kind) => pools[kind].length > 0);
  let roll = rng.next() * kinds.reduce((sum, kind) => sum + kindWeight(run, kind), 0);
  let kind = kinds.at(-1);
  for (const candidate of kinds) {
    roll -= kindWeight(run, candidate);
    if (roll < 0) {
      kind = candidate;
      break;
    }
  }
  if (!kind) return null;
  const pool = pools[kind];
  return pool.splice(rng.int(pool.length), 1)[0] ?? null;
}

function rollItems(run: RunState, rng: Rng): (ShopItem | null)[] {
  const pools = buildPools(run, rng);
  const items: (ShopItem | null)[] = [];
  while (items.length < shopItemSlots(run)) items.push(drawItem(run, pools, rng));
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
  const shown = new Set(existing.filter((it): it is ShopItem => !!it).map((it) =>
    it.kind === 'tile' ? `${it.kind}:${it.tile.id}` : `${it.kind}:${it.id}`,
  ));
  const pools = buildPools(run, rng);
  for (const kind of Object.keys(pools) as ItemKind[]) {
    pools[kind] = pools[kind].filter((it) => {
      const key = it.kind === 'tile' ? `${it.kind}:${it.tile.id}` : `${it.kind}:${it.id}`;
      return !shown.has(key);
    });
  }
  return drawItem(run, pools, rng);
}

/**
 * Roll the next chapter's voucher offer (playtest-03 C): a not-yet-owned voucher.
 * Purchased vouchers are in run.vouchers and thus never reappear; unpurchased
 * ones stay in the pool and may reappear in a later chapter.
 */
export function rollVoucherOffer(
  run: RunState,
  rng: Rng,
  profileUnlocked: ReadonlySet<VoucherId> = new Set(),
): VoucherId | null {
  const available = availableVoucherIds(run, profileUnlocked);
  return available.length ? rng.shuffle(available)[0]! : null;
}

/** Each pack slot rolls an independent type × size (Mega/Jumbo rarer). */
// Weighted type/size draws without replacement; Mega/Jumbo remain rarer.
function rollPacks(rng: Rng): (PackSlot | null)[] {
  const pool = PACK_TYPES.flatMap((type) =>
    PACK_SIZES.map((size) => ({
      type,
      size,
      weight: (BALANCE.pack.typeWeights[type] ?? 0) * (BALANCE.pack.sizeWeights[size] ?? 0),
    })),
  );
  const packs: (PackSlot | null)[] = [];
  for (let i = 0; i < BALANCE.shop.packSlots; i++) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * total;
    let index = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j]!.weight;
      if (roll < 0) {
        index = j;
        break;
      }
    }
    const { type, size } = pool.splice(index, 1)[0]!;
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
    if (!canAddJoker(run, item.id, item.edition ?? 'base')) return fail;
    nextRun = {
      ...run,
      gold: run.gold - item.price,
      jokers: [...run.jokers, { defId: item.id, edition: item.edition ?? 'base', state: {} }],
    };
  } else if (item.kind === 'tile') {
    nextRun = { ...run, gold: run.gold - item.price, bag: [...run.bag, item.tile] };
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
