/**
 * Packs (GDD §9.3) — where jokers, tiles, and materials/fonts enter the economy
 * as a draft-flavored choice. rollPack builds an offer of options; the player
 * picks up to `pick` of them; applyPackPick folds a pick into the run.
 */

import { BALANCE } from './balance';
import { ALL_JOKERS } from './jokers';
import { packEnhanceChance } from './vouchers';
import type { Rng } from './rng';
import type {
  ConsumableId,
  Letter,
  PackKind,
  RunState,
  Tile,
  TileFont,
  TileMaterial,
} from './types';

const CONSUMABLE_POOL: readonly ConsumableId[] = ['magnifier'];
const MATERIALS: readonly TileMaterial[] = [
  'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass',
];
const FONTS: readonly TileFont[] = ['lightItalic', 'bold', 'inline', 'black'];

/** Letters weighted by the starting bag composition (natural distribution). */
const WEIGHTED_LETTERS: readonly Letter[] = Object.entries(BALANCE.bagComposition).flatMap(
  ([letter, count]) => Array.from({ length: count }, () => letter as Letter),
);

export type PackOption =
  | { kind: 'joker'; id: string }
  | { kind: 'tile'; tile: Tile }
  | { kind: 'consumable'; id: ConsumableId };

export interface PackOffer {
  kind: PackKind;
  options: PackOption[];
  /** how many options the player may take */
  pick: number;
}

function rollTile(run: RunState, rng: Rng, index: number): Tile {
  const letter = WEIGHTED_LETTERS[rng.int(WEIGHTED_LETTERS.length)]!;
  let material: TileMaterial = 'ceramic';
  let font: TileFont = 'medium';
  if (rng.next() < packEnhanceChance(run)) {
    if (rng.next() < 0.5) material = MATERIALS[rng.int(MATERIALS.length)]!;
    else font = FONTS[rng.int(FONTS.length)]!;
  }
  return {
    id: `pk${rng.int(1_000_000)}-${index}`,
    // Stone carries no letter — the invariant that forces gibberish (GDD §2.2)
    letter: material === 'stone' ? null : letter,
    case: 'upper',
    material,
    font,
  };
}

export function rollPack(kind: PackKind, run: RunState, rng: Rng): PackOffer {
  const cfg = BALANCE.pack[kind];
  if (kind === 'emoji') {
    const owned = new Set(run.jokers.map((j) => j.defId));
    const pool = ALL_JOKERS.filter((j) => !owned.has(j.id));
    const options: PackOption[] = rng
      .shuffle(pool)
      .slice(0, cfg.show)
      .map((j) => ({ kind: 'joker', id: j.id }));
    return { kind, options, pick: cfg.pick };
  }
  if (kind === 'consumable') {
    const options: PackOption[] = rng
      .shuffle([...CONSUMABLE_POOL])
      .slice(0, cfg.show)
      .map((id) => ({ kind: 'consumable', id }));
    return { kind, options, pick: cfg.pick };
  }
  const options: PackOption[] = [];
  for (let i = 0; i < cfg.show; i++) options.push({ kind: 'tile', tile: rollTile(run, rng, i) });
  return { kind, options, pick: cfg.pick };
}

/** Apply one chosen option to the run (skips silently if a slot is full). */
export function applyPackPick(run: RunState, option: PackOption): RunState {
  switch (option.kind) {
    case 'joker':
      if (run.jokers.length >= BALANCE.jokerSlots) return run;
      return { ...run, jokers: [...run.jokers, { defId: option.id, state: {} }] };
    case 'tile':
      return { ...run, bag: [...run.bag, option.tile] };
    case 'consumable':
      if (run.consumables.length >= run.consumableSlots) return run;
      return { ...run, consumables: [...run.consumables, option.id] };
  }
}
