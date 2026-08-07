/**
 * Shop (GDD §9.2): item-slot stock generation, buy, sell, reroll. Pure and
 * seeded — the stock is reproducible from the run seed + reroll RNG. Packs and
 * vouchers are separate slots (deferred); this covers the item slots + economy.
 */

import { BALANCE } from './balance';
import { createOwnedJoker, defaultJokerBus, JOKER_REGISTRY } from './jokers';
import { availableJokerDefs, sampleJokerDefs } from './offers';
import {
  consumableBuyPrice,
  emojiTileBuyPrice,
  emojiTileSellValue,
  rerollCost,
  tileBuyPrice,
} from './economy';
import { rollJokerEdition } from './editions';
import { CONSTELLATION_POOL, rollTile, FABLE_POOL } from './packs';
import { ORDINARY_GAMBLER_IDS } from './gamblerIds';
import { pouchAllowsGamblerShop } from './pouches';
import {
  CONSUMABLE_PATTERN,
  VOUCHER_REGISTRY,
  applyVoucher,
  availableVoucherIds,
  canAddJoker,
  allowsDuplicateOffers,
  canOwnConsumable,
  constellationShopWeight,
  fableShopWeight,
  rerollDiscount,
  shopSellsTiles,
  shopTilesCanBeEnhanced,
  shopItemSlots,
} from './vouchers';
import type { Rng } from './rng';
import type {
  OwnedJoker,
  JokerEdition,
  JokerRarity,
  PackSize,
  PackSlot,
  PackType,
  RunState,
  ShopItem,
  ShopState,
  SkipRewardId,
  VoucherId,
} from './types';

const PACK_TYPES: readonly PackType[] = ['pattern', 'joker', 'consumable', 'tile', 'ink'];
const PACK_SIZES: readonly PackSize[] = ['normal', 'jumbo', 'mega'];

const RARITY_TAGS: Partial<Record<SkipRewardId, JokerRarity>> = {
  uncommonTag: 'uncommon',
  rareTag: 'rare',
};
const EDITION_TAGS: Partial<Record<SkipRewardId, JokerEdition>> = {
  whiteTag: 'white',
  violetTag: 'violet',
  rainbowTag: 'rainbow',
  grayTag: 'gray',
};

type ItemKind = ShopItem['kind'];
type PoolKind = ItemKind | 'gambler';
type ItemPools = Record<PoolKind, ShopItem[]>;

/** All items the shop could offer this run, grouped so pool size cannot skew type odds. */
function buildPools(
  run: RunState,
  rng: Rng,
  profileEligible?: ReadonlySet<string>,
): ItemPools {
  // Rarity-weighted, no-duplicate joker candidates via the shared offer pool
  // (C-1/C-2). A bounded sample (slots + spare, capped by the pool) keeps the
  // joker : Fable : Constellation : tile type-mix balanced while respecting the
  // rarity odds — listing every joker once would both ignore rarity and flood the
  // pool. Legendary never appears (weight 0); a fully-owned pool yields none.
  const jokerCount = shopItemSlots(run) + 2;
  const jokers: ShopItem[] = sampleJokerDefs(run, jokerCount, rng, new Set(), profileEligible).map((j) => {
    const edition = rollJokerEdition(run, rng);
    return {
      kind: 'joker',
      id: j.id,
      edition,
      price: emojiTileBuyPrice(run, BALANCE.jokerPrice[j.rarity], edition),
    };
  });
  const consumables: ShopItem[] = FABLE_POOL.filter((id) => canOwnConsumable(run, id)).map((id) => ({
    kind: 'consumable',
    id,
    price: consumableBuyPrice(run, id),
  }));
  const gamblers: ShopItem[] = (pouchAllowsGamblerShop(run) ? ORDINARY_GAMBLER_IDS : [])
    .filter((id) => canOwnConsumable(run, id)).map((id) => ({
    kind: 'consumable',
    id,
    price: consumableBuyPrice(run, id),
  }));
  const punctuation: ShopItem[] = CONSTELLATION_POOL.filter((id) => canOwnConsumable(run, id)).map((id) => ({
    kind: 'punctuation',
    id,
    pattern: CONSUMABLE_PATTERN[id]!,
    price: consumableBuyPrice(run, id),
  }));
  const tiles: ShopItem[] = shopSellsTiles(run)
    ? Array.from({ length: 4 }, (_, i) => {
        const tile = rollTile(run, rng, i, shopTilesCanBeEnhanced(run) ? 'shop' : 'none');
        return { kind: 'tile' as const, tile, price: tileBuyPrice(run, tile) };
      })
    : [];
  return { joker: jokers, tile: tiles, consumable: consumables, punctuation, gambler: gamblers };
}

function kindWeight(run: RunState, kind: PoolKind): number {
  const base = BALANCE.shop.itemWeights[kind];
  if (kind === 'consumable') return base * fableShopWeight(run);
  if (kind === 'punctuation') return base * constellationShopWeight(run);
  return base;
}

function drawItem(run: RunState, pools: ItemPools, rng: Rng): ShopItem | null {
  const kinds = (Object.keys(pools) as PoolKind[]).filter((kind) => pools[kind].length > 0);
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
  const index = rng.int(pool.length);
  return allowsDuplicateOffers(run) && kind !== 'tile'
    ? pool[index] ?? null
    : pool.splice(index, 1)[0] ?? null;
}

function rollItems(
  run: RunState,
  rng: Rng,
  excludedJokers: ReadonlySet<string> = new Set(),
  profileEligible?: ReadonlySet<string>,
): (ShopItem | null)[] {
  const pools = buildPools(run, rng, profileEligible);
  pools.joker = pools.joker.filter((item) =>
    item.kind !== 'joker' || !excludedJokers.has(item.id),
  );
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
  profileEligible?: ReadonlySet<string>,
): ShopItem | null {
  const shown = new Set(existing.filter((it): it is ShopItem => !!it).map((it) =>
    it.kind === 'tile' ? `${it.kind}:${it.tile.id}` : `${it.kind}:${it.id}`,
  ));
  const pools = buildPools(run, rng, profileEligible);
  for (const kind of Object.keys(pools) as PoolKind[]) {
    if (allowsDuplicateOffers(run) && kind !== 'tile') continue;
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
  const boughtBases = new Set(run.voucherBasesBoughtThisChapter ?? []);
  // Legacy mid-chapter saves predate the explicit list. Their fixed, now-owned
  // offer is the one base voucher we can recover without changing save versions.
  if (
    run.voucherBasesBoughtThisChapter === undefined &&
    run.voucherLocked &&
    run.voucherOffer &&
    run.vouchers.includes(run.voucherOffer) &&
    VOUCHER_REGISTRY.get(run.voucherOffer)?.tier === 'base'
  ) boughtBases.add(run.voucherOffer);
  const available = availableVoucherIds(run, profileUnlocked).filter((id) => {
    const baseId = VOUCHER_REGISTRY.get(id)?.baseId;
    return !baseId || !boughtBases.has(baseId);
  });
  return available.length ? rng.shuffle(available)[0]! : null;
}

/** Each pack slot rolls an independent type × size (Mega/Jumbo rarer). */
// Weighted type/size draws without replacement; Mega/Jumbo remain rarer.
function rollPacks(rng: Rng, guaranteeBasicCharm = false): (PackSlot | null)[] {
  const pool = PACK_TYPES.flatMap((type) =>
    PACK_SIZES.map((size) => ({
      type,
      size,
      weight: (BALANCE.pack.typeWeights[type] ?? 0) * (BALANCE.pack.sizeWeights[size] ?? 0),
    })),
  );
  const packs: (PackSlot | null)[] = [];
  if (guaranteeBasicCharm) {
    const index = pool.findIndex((entry) => entry.type === 'joker' && entry.size === 'normal');
    const { type, size } = pool.splice(index, 1)[0]!;
    packs.push({
      type,
      size,
      artVariant: rng.int(BALANCE.pack.artVariants[type][size]),
    });
  }
  while (packs.length < BALANCE.shop.packSlots) {
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
export function rollShopStock(
  run: RunState,
  rng: Rng,
  profileEligible?: ReadonlySet<string>,
): ShopState {
  return {
    items: rollItems(run, rng, new Set(), profileEligible),
    voucher: run.voucherLocked ? null : run.voucherOffer,
    bonusVoucher: null,
    packs: rollPacks(rng, (run.shopsVisited ?? 0) === 0),
    rerolls: 0,
  };
}

export interface PreparedShop {
  run: RunState;
  shop: ShopState;
  /** Pending Tags whose effects actually resolved against this stock. */
  appliedTags: SkipRewardId[];
}

/** Apply every pending shop tag that can resolve against this stock. */
export function applyPendingShopTags(
  run: RunState,
  shop: ShopState,
  rng: Rng,
  profileUnlocked: ReadonlySet<VoucherId> = new Set(),
  profileEligible?: ReadonlySet<string>,
): PreparedShop {
  const tags = run.pendingShopTags ?? [];
  if (tags.length === 0) return { run, shop, appliedTags: [] };

  let items = shop.items.slice();
  let packs = shop.packs.slice();
  let bonusVoucher = shop.bonusVoucher ?? null;
  const consumed = new Set<number>();

  // Guaranteed-rarity tags add inventory first, so a later edition tag can
  // enhance that newly-added base Emoji Tile when ordinary stock has none.
  tags.forEach((tag, tagIndex) => {
    const rarity = RARITY_TAGS[tag];
    if (!rarity) return;
    const shown = new Set(
      items.flatMap((item) => item?.kind === 'joker' ? [item.id] : []),
    );
    const pool = availableJokerDefs(run, profileEligible).filter(
      (def) => def.rarity === rarity && (allowsDuplicateOffers(run) || !shown.has(def.id)),
    );
    const def = pool.length > 0 ? pool[rng.int(pool.length)] : undefined;
    if (!def) return;
    items.push({
      kind: 'joker',
      id: def.id,
      edition: 'base',
      price: 0,
      rarityTag: rarity === 'uncommon' ? 'uncommonTag' : 'rareTag',
    });
    consumed.add(tagIndex);
  });

  // One additional choice. Locked Chapters cannot start a tagged pair, so the
  // tag waits for the next shop where its reward can actually resolve.
  tags.forEach((tag, tagIndex) => {
    if (tag !== 'voucherTag' || consumed.has(tagIndex) || bonusVoucher || run.voucherLocked) {
      return;
    }
    const candidates = availableVoucherIds(run, profileUnlocked).filter(
      (id) => id !== shop.voucher,
    );
    if (candidates.length === 0) return;
    bonusVoucher = candidates[rng.int(candidates.length)]!;
    consumed.add(tagIndex);
  });

  tags.forEach((tag, tagIndex) => {
    const edition = EDITION_TAGS[tag];
    if (!edition) return;
    const itemIndex = items.findIndex(
      (item) => item?.kind === 'joker' && (item.edition ?? 'base') === 'base',
    );
    const item = itemIndex >= 0 ? items[itemIndex] : null;
    if (!item || item.kind !== 'joker') return;
    items[itemIndex] = { ...item, edition, price: 0 };
    consumed.add(tagIndex);
  });

  if (tags.some((tag) => tag === 'couponTag')) {
    items = items.map((item) => item ? { ...item, price: 0 } : null);
    packs = packs.map((pack) => pack ? { ...pack, free: true } : null);
    tags.forEach((tag, tagIndex) => {
      if (tag === 'couponTag') consumed.add(tagIndex);
    });
  }

  return {
    run: {
      ...run,
      pendingShopTags: tags.filter((_, index) => !consumed.has(index)),
    },
    shop: { ...shop, items, packs, bonusVoucher },
    appliedTags: tags.filter((_, index) => consumed.has(index)),
  };
}

/** Roll and tag-adjust the next real shop in one seeded operation. */
export function prepareShop(
  run: RunState,
  rng: Rng,
  profileUnlocked: ReadonlySet<VoucherId> = new Set(),
  profileEligible?: ReadonlySet<string>,
): PreparedShop {
  const prepared = applyPendingShopTags(
    run,
    rollShopStock(run, rng, profileEligible),
    rng,
    profileUnlocked,
    profileEligible,
  );
  return {
    ...prepared,
    run: { ...prepared.run, shopsVisited: (run.shopsVisited ?? 0) + 1 },
  };
}

export interface BuyResult {
  run: RunState;
  shop: ShopState;
  ok: boolean;
  /** Present on rerolls when waiting shop Tags resolve against the new stock. */
  appliedTags?: SkipRewardId[];
}

const repriceShopItem = (run: RunState, item: ShopItem): ShopItem => {
  if (item.price === 0) return item;
  if (item.kind === 'joker') {
    const def = JOKER_REGISTRY.get(item.id);
    return def
      ? { ...item, price: emojiTileBuyPrice(run, BALANCE.jokerPrice[def.rarity], item.edition) }
      : item;
  }
  return {
    ...item,
    price: item.kind === 'tile'
      ? tileBuyPrice(run, item.tile)
      : consumableBuyPrice(run, item.id),
  };
};

/** Buy the item in slot `index`, respecting gold and joker/consumable slot caps. */
export function buyItem(
  run: RunState,
  shop: ShopState,
  index: number,
  profileEligible?: ReadonlySet<string>,
): BuyResult {
  const item = shop.items[index];
  const fail: BuyResult = { run, shop, ok: false };
  if (!item || run.gold < item.price) return fail;

  let nextRun: RunState;
  if (item.kind === 'joker') {
    if (!canAddJoker(run, item.id, item.edition ?? 'base', profileEligible)) return fail;
    nextRun = {
      ...run,
      gold: run.gold - item.price,
      jokers: [...run.jokers, createOwnedJoker(run, item.id, item.edition ?? 'base')],
    };
  } else if (item.kind === 'tile') {
    nextRun = { ...run, gold: run.gold - item.price, bag: [...run.bag, item.tile] };
  } else {
    if (run.consumables.length >= run.consumableSlots) return fail;
    if (!canOwnConsumable(run, item.id)) return fail;
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
export function sellJoker(run: RunState, index: number, rng: Rng): SellResult {
  const owned: OwnedJoker | undefined = run.jokers[index];
  if (!owned) return { run, ok: false };
  const def = JOKER_REGISTRY.get(owned.defId);
  const value = def
    ? emojiTileSellValue(
        run,
        BALANCE.jokerPrice[def.rarity],
        owned.edition ?? 'base',
        owned.state.sellBonus ?? 0,
      )
    : 1;
  const nextRun = {
    ...run,
    gold: run.gold + value,
    jokers: run.jokers.filter((_, i) => i !== index),
  };
  defaultJokerBus.emit('selfSold', { run: nextRun, rng }, [owned]);
  return { run: nextRun, ok: true };
}

/** Whether the selected slot can be redeemed under the ordinary Chapter lock.
 * Voucher Tag's surviving choice is normalized into the bonus slot, which is
 * the one explicit second-purchase exception. */
export function canBuyVoucher(
  run: RunState,
  shop: ShopState,
  slot: 'base' | 'bonus' = 'base',
): boolean {
  const id = slot === 'bonus' ? shop.bonusVoucher : shop.voucher;
  if (!id) return false;
  return !run.voucherLocked
    || (slot === 'bonus' && shop.voucher === null);
}

/** Buy the offered voucher and apply its effect. Ordinary shops lock after one
 * purchase; Voucher Tag keeps the other choice as one redeemable bonus slot. */
export function buyVoucher(
  run: RunState,
  shop: ShopState,
  slot: 'base' | 'bonus' = 'base',
): BuyResult {
  const id = slot === 'bonus' ? shop.bonusVoucher : shop.voucher;
  if (!id || !canBuyVoucher(run, shop, slot)) return { run, shop, ok: false };
  const def = VOUCHER_REGISTRY.get(id);
  if (!def || run.gold < def.price) return { run, shop, ok: false };
  const boughtBases = run.voucherBasesBoughtThisChapter ?? [];
  const nextRun = applyVoucher({
    ...run,
    gold: run.gold - def.price,
    voucherLocked: true,
    voucherBasesBoughtThisChapter:
      def.tier === 'base' && !boughtBases.includes(id) ? [...boughtBases, id] : boughtBases,
  }, id);
  const remaining = slot === 'base' ? shop.bonusVoucher : shop.voucher;
  const items = id === 'newspaper' || id === 'papyrus'
    ? shop.items.map((item) => item ? repriceShopItem(nextRun, item) : null)
    : shop.items;
  return {
    run: nextRun,
    // Always keep a tagged pair's survivor in the bonus slot. That single shape
    // lets the shared gate distinguish it from a forged ordinary locked offer.
    shop: { ...shop, items, voucher: null, bonusVoucher: remaining },
    ok: true,
  };
}

/** Reroll the item slots only, for the escalating (voucher-discounted) cost (GDD §9.2). */
export function rerollShop(
  run: RunState,
  shop: ShopState,
  rng: Rng,
  profileUnlocked: ReadonlySet<VoucherId> = new Set(),
  profileEligible?: ReadonlySet<string>,
): BuyResult {
  const cost = rerollCost(shop.rerolls, rerollDiscount(run));
  if (run.gold < cost) return { run, shop, ok: false };
  const nextRun = { ...run, gold: run.gold - cost };
  const tagged = shop.items.filter(
    (item): item is Extract<ShopItem, { kind: 'joker' }> =>
      item?.kind === 'joker' && item.rarityTag !== undefined,
  );
  const taggedIds = new Set(tagged.map((item) => item.id));
  const prepared = applyPendingShopTags(
    nextRun,
    {
      ...shop,
      items: [...rollItems(nextRun, rng, taggedIds, profileEligible), ...tagged],
      rerolls: shop.rerolls + 1,
    },
    rng,
    profileUnlocked,
    profileEligible,
  );
  return { ...prepared, ok: true };
}
