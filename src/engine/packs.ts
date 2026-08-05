/**
 * Packs (GDD §9.3, feature-02 B) — where jokers, tiles, punctuation, and stationery
 * enter the economy as a draft-flavored choice.
 * A pack slot is a { type, size }: size governs show/pick counts + price, type
 * governs the option pool. rollPack builds the offer; applyPackPick folds a pick
 * into the run. The UI controller resolves ordinary Fables immediately against
 * their pack candidates; applyPackPick remains the low-level "take this object"
 * fold used by tiles, jokers, Constellations, and blind-only Fables.
 */

import { BALANCE, packSizeRules } from './balance';
import { CONSTELLATION_IDS, CONSTELLATION_PATTERN } from './constellations';
import { sampleJokerDefs } from './offers';
import { rollJokerEdition, rollShopTileEdition, rollTileEdition } from './editions';
import { FABLE_IDS } from './fables';
import { GAMBLER_IDS } from './gamblers';
import { createOwnedJoker } from './jokers';
import {
  canAddJoker,
  allowsDuplicateOffers,
  canOwnConsumable,
  fablePacksContainInk,
  hasVoucher,
  mostPlayedPattern,
  PATTERN_CONSUMABLE,
} from './vouchers';
import type { Rng } from './rng';
import type {
  ConsumableId,
  Letter,
  PackSize,
  PackSlot,
  PackType,
  PatternId,
  RunState,
  ShopItem,
  Tile,
  TileFont,
  TileMaterial,
} from './types';

/** Fable-card pool — a Fable Pack's contents and the discardGain font-seal reward. */
export const FABLE_POOL: readonly ConsumableId[] = FABLE_IDS;

/** Constellation-card pool — a Constellation Pack's contents. */
export const CONSTELLATION_POOL: readonly ConsumableId[] = CONSTELLATION_IDS;

/** Gambler-card pool — the Ink Pack's contents (GDD §9.3, §10.3). */
export const GAMBLER_POOL: readonly ConsumableId[] = GAMBLER_IDS;
const INK_BASE_POOL = GAMBLER_IDS.filter((id) => id !== 'phoenix' && id !== 'deer');

const MATERIALS: readonly TileMaterial[] = [
  'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass', 'wood',
];
const FONTS: readonly TileFont[] = ['lightItalic', 'bold', 'inline', 'black'];

/** Letters weighted by the starting bag composition (natural distribution). */
const WEIGHTED_LETTERS: readonly Letter[] = Object.entries(BALANCE.bagComposition).flatMap(
  ([letter, count]) => Array.from({ length: count }, () => letter as Letter),
);

export type PackOption =
  | { kind: 'joker'; id: string; edition: import('./types').JokerEdition }
  | { kind: 'tile'; tile: Tile }
  | { kind: 'consumable'; id: ConsumableId }
  | { kind: 'punctuation'; id: ConsumableId; pattern: PatternId };

export interface PackOffer {
  type: PackType;
  size: PackSize;
  /** cosmetic art-variant index carried from the slot (UI → packArt.ts). */
  artVariant: number;
  options: PackOption[];
  /** how many options the player may take */
  pick: number;
}

export function rollTile(
  run: RunState,
  rng: Rng,
  index: number,
  source: 'pack' | 'shop' | 'none' = 'pack',
): Tile {
  const letter = WEIGHTED_LETTERS[rng.int(WEIGHTED_LETTERS.length)]!;
  let material: TileMaterial = 'ceramic';
  let font: TileFont = 'medium';
  if (source !== 'none' && rng.next() < BALANCE.pack.tileModifiers.materialChance) {
    material = MATERIALS[rng.int(MATERIALS.length)]!;
  }
  if (source === 'pack' && rng.next() < BALANCE.pack.tileModifiers.fontChance) {
    const rolled = FONTS[rng.int(FONTS.length)]!;
    if (material !== 'stone') font = rolled;
  }
  return {
    id: `pk${rng.int(1_000_000)}-${index}`,
    // Stone carries no letter — the invariant that forces gibberish (GDD §2.2)
    letter: material === 'stone' ? null : letter,
    ...(material === 'stone' ? { letterBeforeStone: letter } : {}),
    material,
    font,
    edition: source === 'pack'
      ? rollTileEdition(run, rng)
      : source === 'shop'
        ? rollShopTileEdition(rng)
        : 'base',
  };
}

/** Draw `show` distinct consumable ids from a pool → typed pack options. */
function drawConsumables(
  pool: readonly ConsumableId[],
  show: number,
  rng: Rng,
  make: (id: ConsumableId) => PackOption,
  withReplacement = false,
): PackOption[] {
  if (!withReplacement) return rng.shuffle([...pool]).slice(0, show).map(make);
  return pool.length === 0
    ? []
    : Array.from({ length: show }, () => make(pool[rng.int(pool.length)]!));
}

/** Take one weighted id without replacement from the remaining Ink pool. */
function takeWeightedInk(remaining: ConsumableId[], rng: Rng, withReplacement = false): ConsumableId {
  const weight = (id: ConsumableId) => BALANCE.pack.inkGamblerWeights[id] ?? 1;
  let roll = rng.next() * remaining.reduce((sum, id) => sum + weight(id), 0);
  let picked = remaining.length - 1;
  for (let index = 0; index < remaining.length; index += 1) {
    roll -= weight(remaining[index]!);
    if (roll < 0) {
      picked = index;
      break;
    }
  }
  return withReplacement ? remaining[picked]! : remaining.splice(picked, 1)[0]!;
}

export function rollPack(
  slot: PackSlot,
  run: RunState,
  rng: Rng,
  liveShopItems: readonly (ShopItem | null)[] = [],
  profileEligible?: ReadonlySet<string>,
): PackOffer {
  const { show, pick } = packSizeRules(slot.type, slot.size);
  const withReplacement = allowsDuplicateOffers(run);
  const excludedIds = new Set(liveShopItems.flatMap((item) =>
    item && item.kind !== 'tile' ? [item.id] : [],
  ));
  const canOfferConsumable = (id: ConsumableId) =>
    !excludedIds.has(id) && canOwnConsumable(run, id);
  let options: PackOption[];
  switch (slot.type) {
    case 'joker': {
      // Rarity-weighted, no-duplicate draw via the shared offer pool (C-1/C-2).
      options = sampleJokerDefs(run, show, rng, excludedIds, profileEligible).map((j) => ({
        kind: 'joker',
        id: j.id,
        edition: rollJokerEdition(run, rng),
      }));
      break;
    }
    case 'tile': {
      options = [];
      for (let i = 0; i < show; i++) options.push({ kind: 'tile', tile: rollTile(run, rng, i) });
      break;
    }
    case 'consumable': {
      const pool = FABLE_POOL.filter(canOfferConsumable);
      options = drawConsumables(pool, show, rng, (id) => ({ kind: 'consumable', id }), withReplacement);
      const phoenixShown = new Set<ConsumableId>();
      options = options.map((option) => {
        const replace = rng.next() < BALANCE.pack.phoenixChance &&
          canOfferConsumable('phoenix') && (withReplacement || !phoenixShown.has('phoenix'));
        if (replace) phoenixShown.add('phoenix');
        return replace ? { kind: 'consumable', id: 'phoenix' } : option;
      });
      // Comic Book adds an ordinary Gambler replacement, capped at one per pack.
      // Phoenix above is the separate voucher-free jackpot route.
      if (fablePacksContainInk(run)) {
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          if (option?.kind === 'consumable' && option.id !== 'phoenix' &&
              rng.next() < BALANCE.pack.gamblerInFableChance) {
            const candidates = INK_BASE_POOL.filter((id) => canOfferConsumable(id) &&
              (withReplacement || !options.some((entry) => entry.kind === 'consumable' && entry.id === id)));
            if (candidates.length > 0) options[i] = {
              kind: 'consumable',
              id: candidates[rng.int(candidates.length)]!,
            };
            break;
          }
        }
      }
      break;
    }
    case 'ink': {
      const ordinary = INK_BASE_POOL.filter(canOfferConsumable);
      options = [];
      while (options.length < show && (ordinary.length > 0 || withReplacement)) {
        const roll = rng.next();
        const shown = new Set(options.flatMap((option) => option.kind === 'consumable' ? [option.id] : []));
        const phoenixAllowed = canOfferConsumable('phoenix') && (withReplacement || !shown.has('phoenix'));
        const deerAllowed = canOfferConsumable('deer') && (withReplacement || !shown.has('deer'));
        const id = roll < BALANCE.pack.phoenixChance && phoenixAllowed
          ? 'phoenix'
          : roll < BALANCE.pack.phoenixChance + BALANCE.pack.deerChance && deerAllowed
            ? 'deer'
            : ordinary.length > 0 ? takeWeightedInk(ordinary, rng, withReplacement) : null;
        if (!id) break;
        options.push({ kind: 'consumable', id });
      }
      break;
    }
    case 'pattern': {
      const pool = CONSTELLATION_POOL.filter(canOfferConsumable);
      options = drawConsumables(pool, show, rng, (id) => ({
        kind: 'punctuation',
        id,
        pattern: CONSTELLATION_PATTERN[id]!,
      }), withReplacement);
      if (hasVoucher(run, 'bwPhoto')) {
        const favorite = mostPlayedPattern(run);
        const id = favorite ? PATTERN_CONSUMABLE[favorite] : null;
        if (favorite && id && canOfferConsumable(id) && !options.some((o) => o.kind === 'punctuation' && o.pattern === favorite)) {
          options[options.length - 1] = { kind: 'punctuation', id, pattern: favorite };
        }
      }
      // Deer is an independent jackpot roll for every Constellation choice.
      const deerShown = new Set<ConsumableId>();
      options = options.map((option) => {
        const replace = rng.next() < BALANCE.pack.deerChance &&
          canOfferConsumable('deer') && (withReplacement || !deerShown.has('deer'));
        if (replace) deerShown.add('deer');
        return replace ? { kind: 'consumable', id: 'deer' } : option;
      });
      break;
    }
  }
  return { type: slot.type, size: slot.size, artVariant: slot.artVariant, options, pick };
}

/** Apply one chosen option to the run (skips silently if a slot is full). */
export function applyPackPick(
  run: RunState,
  option: PackOption,
  profileEligible?: ReadonlySet<string>,
): RunState {
  switch (option.kind) {
    case 'joker':
      if (!canAddJoker(run, option.id, option.edition, profileEligible)) return run;
      return {
        ...run,
        jokers: [...run.jokers, createOwnedJoker(run, option.id, option.edition)],
      };
    case 'tile':
      return { ...run, bag: [...run.bag, option.tile] };
    case 'consumable':
      if (run.consumables.length >= run.consumableSlots) return run;
      if (!canOwnConsumable(run, option.id)) return run;
      return { ...run, consumables: [...run.consumables, option.id] };
    case 'punctuation':
      if (run.consumables.length >= run.consumableSlots) return run;
      if (!canOwnConsumable(run, option.id)) return run;
      return { ...run, consumables: [...run.consumables, option.id] };
  }
}
