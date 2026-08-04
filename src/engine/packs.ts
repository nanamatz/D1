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
import {
  canAddJoker,
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
    font = FONTS[rng.int(FONTS.length)]!;
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
): PackOption[] {
  return rng.shuffle([...pool]).slice(0, show).map(make);
}

export function rollPack(slot: PackSlot, run: RunState, rng: Rng): PackOffer {
  const { show, pick } = packSizeRules(slot.type, slot.size);
  let options: PackOption[];
  switch (slot.type) {
    case 'joker': {
      // Rarity-weighted, no-duplicate draw via the shared offer pool (C-1/C-2).
      options = sampleJokerDefs(run, show, rng).map((j) => ({
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
      options = drawConsumables(FABLE_POOL, show, rng, (id) => ({ kind: 'consumable', id }));
      options = options.map((option) =>
        rng.next() < BALANCE.pack.jackpotChance
          ? { kind: 'consumable', id: 'phoenix' }
          : option,
      );
      // Comic Book adds an ordinary Gambler replacement, capped at one per pack.
      // Phoenix above is the separate voucher-free jackpot route.
      if (fablePacksContainInk(run)) {
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          if (option?.kind === 'consumable' && option.id !== 'phoenix' &&
              rng.next() < BALANCE.pack.gamblerInFableChance) {
            options[i] = {
              kind: 'consumable',
              id: INK_BASE_POOL[rng.int(INK_BASE_POOL.length)]!,
            };
            break;
          }
        }
      }
      break;
    }
    case 'ink': {
      const ordinary = rng.shuffle([...INK_BASE_POOL]);
      options = Array.from({ length: show }, (_, index) => {
        const roll = rng.next();
        const id = roll < BALANCE.pack.jackpotChance
          ? 'phoenix'
          : roll < BALANCE.pack.jackpotChance * 2
            ? 'deer'
            : ordinary[index % ordinary.length]!;
        return { kind: 'consumable' as const, id };
      });
      break;
    }
    case 'pattern': {
      const held = new Set(run.consumables);
      const pool = CONSTELLATION_POOL.filter((id) => !held.has(id));
      options = drawConsumables(pool, show, rng, (id) => ({
        kind: 'punctuation',
        id,
        pattern: CONSTELLATION_PATTERN[id]!,
      }));
      if (hasVoucher(run, 'bwPhoto')) {
        const favorite = mostPlayedPattern(run);
        const id = favorite ? PATTERN_CONSUMABLE[favorite] : null;
        if (favorite && id && !options.some((o) => o.kind === 'punctuation' && o.pattern === favorite)) {
          options[options.length - 1] = { kind: 'punctuation', id, pattern: favorite };
        }
      }
      // Deer is an independent jackpot roll for every Constellation choice.
      options = options.map((option) =>
        rng.next() < BALANCE.pack.jackpotChance
          ? { kind: 'consumable', id: 'deer' }
          : option,
      );
      break;
    }
  }
  return { type: slot.type, size: slot.size, artVariant: slot.artVariant, options, pick };
}

/** Apply one chosen option to the run (skips silently if a slot is full). */
export function applyPackPick(run: RunState, option: PackOption): RunState {
  switch (option.kind) {
    case 'joker':
      if (!canAddJoker(run, option.id, option.edition)) return run;
      return {
        ...run,
        jokers: [...run.jokers, { defId: option.id, edition: option.edition, state: {} }],
      };
    case 'tile':
      return { ...run, bag: [...run.bag, option.tile] };
    case 'consumable':
      if (run.consumables.length >= run.consumableSlots) return run;
      return { ...run, consumables: [...run.consumables, option.id] };
    case 'punctuation':
      if (run.consumables.length >= run.consumableSlots) return run;
      return { ...run, consumables: [...run.consumables, option.id] };
  }
}
