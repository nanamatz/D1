/**
 * Packs (GDD §9.3, feature-02 B) — where jokers, tiles, punctuation, stationery,
 * and (rarely) forbidden books enter the economy as a draft-flavored choice.
 * A pack slot is a { type, size }: size governs show/pick counts + price, type
 * governs the option pool. rollPack builds the offer; applyPackPick folds a pick
 * into the run. Punctuation applies IMMEDIATELY on pick (levels its pattern);
 * everything else lands in the bag / a joker or consumable slot.
 */

import { BALANCE } from './balance';
import { ALL_JOKERS } from './jokers';
import { packEnhanceChance } from './vouchers';
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

/** Stationery consumables that actually have an effect today (grows as built). */
export const STATIONERY_POOL: readonly ConsumableId[] = ['magnifier'];
/** Back-compat alias — some call sites still import CONSUMABLE_POOL (discardGain). */
export const CONSUMABLE_POOL = STATIONERY_POOL;

/** Punctuation card → the pattern it levels (GDD §5.4). Typesetting-pack contents. */
const PUNCTUATION_PATTERN: Record<string, PatternId> = {
  ellipsis: 'outcry',
  exclamation: 'imperative',
  doubleExclamation: 'chant',
  period: 'simple',
  colon: 'descriptive',
  semicolon: 'transitive',
  dash: 'ditransitive',
  comma: 'compound',
};
const PUNCTUATION_POOL = Object.keys(PUNCTUATION_PATTERN) as ConsumableId[];

/** Forbidden Books items (GDD §10.3) — effects TBD; the pack delivers them (placeholder). */
const FORBIDDEN_POOL: readonly ConsumableId[] = ['bookBurning', 'apocrypha', 'scribbles', 'apocalypse'];

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
  | { kind: 'consumable'; id: ConsumableId }
  | { kind: 'punctuation'; id: ConsumableId; pattern: PatternId }
  | { kind: 'forbidden'; id: ConsumableId };

export interface PackOffer {
  type: PackType;
  size: PackSize;
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
      const owned = new Set(run.jokers.map((j) => j.defId));
      const pool = ALL_JOKERS.filter((j) => !owned.has(j.id));
      options = rng.shuffle(pool).slice(0, show).map((j) => ({ kind: 'joker', id: j.id }));
      break;
    }
    case 'tile': {
      options = [];
      for (let i = 0; i < show; i++) options.push({ kind: 'tile', tile: rollTile(run, rng, i) });
      break;
    }
    case 'consumable':
      options = drawConsumables(STATIONERY_POOL, show, rng, (id) => ({ kind: 'consumable', id }));
      break;
    case 'pattern':
      options = drawConsumables(PUNCTUATION_POOL, show, rng, (id) => ({
        kind: 'punctuation',
        id,
        pattern: PUNCTUATION_PATTERN[id]!,
      }));
      break;
    case 'forbidden':
      options = drawConsumables(FORBIDDEN_POOL, show, rng, (id) => ({ kind: 'forbidden', id }));
      break;
  }
  return { type: slot.type, size: slot.size, options, pick };
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
    case 'forbidden':
      // Forbidden effects are TBD (feature-02 B placeholder); it still occupies a slot.
      if (run.consumables.length >= run.consumableSlots) return run;
      return { ...run, consumables: [...run.consumables, option.id] };
    case 'punctuation':
      // Applies immediately: level the mapped pattern (no slot needed).
      return {
        ...run,
        patternLevels: {
          ...run.patternLevels,
          [option.pattern]: (run.patternLevels[option.pattern] ?? 1) + 1,
        },
      };
  }
}
