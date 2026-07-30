/**
 * Packs (GDD §9.3, feature-02 B) — where jokers, tiles, punctuation, and stationery
 * enter the economy as a draft-flavored choice.
 * A pack slot is a { type, size }: size governs show/pick counts + price, type
 * governs the option pool. rollPack builds the offer; applyPackPick folds a pick
 * into the run. The UI controller resolves ordinary Fables immediately against
 * their pack candidates; applyPackPick remains the low-level "take this object"
 * fold used by tiles, jokers, Constellations, and blind-only Fables.
 */

import { BALANCE } from './balance';
import { CONSTELLATION_IDS, CONSTELLATION_PATTERN } from './constellations';
import { sampleJokerDefs } from './offers';
import { rollJokerEdition, rollTileEdition } from './editions';
import { FABLE_IDS } from './fables';
import { GAMBLER_IDS } from './gamblers';
import {
  canAddJoker,
  fablePacksContainInk,
  hasVoucher,
  mostPlayedPattern,
  packEnhanceChance,
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

/** Fable-card pool (legacy export name retained for existing semantic call sites). */
export const STATIONERY_POOL: readonly ConsumableId[] = FABLE_IDS;
/** Back-compat alias — some call sites still import CONSUMABLE_POOL (discardGain). */
export const CONSUMABLE_POOL = STATIONERY_POOL;

/** Constellation-card pool. The legacy variable name is internal only. */
export const PUNCTUATION_POOL = [...CONSTELLATION_IDS];

/** Gambler-card pool — the Ink Pack's contents (GDD §9.3, §10.3). */
export const GAMBLER_POOL: readonly ConsumableId[] = GAMBLER_IDS;

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

export function rollTile(run: RunState, rng: Rng, index: number, enhance = true): Tile {
  const letter = WEIGHTED_LETTERS[rng.int(WEIGHTED_LETTERS.length)]!;
  let material: TileMaterial = 'ceramic';
  let font: TileFont = 'medium';
  if (enhance && rng.next() < packEnhanceChance(run)) {
    if (rng.next() < 0.5) material = MATERIALS[rng.int(MATERIALS.length)]!;
    else font = FONTS[rng.int(FONTS.length)]!;
  }
  return {
    id: `pk${rng.int(1_000_000)}-${index}`,
    // Stone carries no letter — the invariant that forces gibberish (GDD §2.2)
    letter: material === 'stone' ? null : letter,
    material,
    font,
    edition: enhance ? rollTileEdition(run, rng) : 'base',
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
  const { show, pick } = BALANCE.pack.size[slot.size];
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
      options = drawConsumables(STATIONERY_POOL, show, rng, (id) => ({ kind: 'consumable', id }));
      // Comic Book (GDD §9.3): each choice rolls to become a Gambler card, capped
      // at one per pack. Without the voucher the chance is exactly 0 — the roll is
      // skipped entirely so the seeded stream is unchanged for runs without it.
      if (fablePacksContainInk(run)) {
        for (let i = 0; i < options.length; i++) {
          if (rng.next() < BALANCE.pack.gamblerInFableChance) {
            options[i] = { kind: 'consumable', id: GAMBLER_IDS[rng.int(GAMBLER_IDS.length)]! };
            break;
          }
        }
      }
      break;
    }
    case 'ink': {
      options = drawConsumables(GAMBLER_POOL, show, rng, (id) => ({ kind: 'consumable', id }));
      break;
    }
    case 'pattern': {
      options = drawConsumables(PUNCTUATION_POOL, show, rng, (id) => ({
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
      // Deer's cross-family exception (GDD §10.3 #9): one Constellation choice may
      // very rarely be replaced, at most once per pack.
      if (rng.next() < BALANCE.pack.deerInConstellationChance && options.length > 0) {
        options[rng.int(options.length)] = { kind: 'consumable', id: 'deer' };
      }
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
