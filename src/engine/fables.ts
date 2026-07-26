/**
 * Fable cards — one-shot run mutations. Pure/headless: the UI supplies the
 * currently staged tile ids and a seeded RNG, then renders the returned state.
 */
import { BALANCE } from './balance';
import { CONSTELLATION_IDS } from './constellations';
import { sellValue } from './economy';
import { ALL_JOKERS, JOKER_REGISTRY } from './jokers';
import type {
  BlindState,
  ConsumableId,
  JokerEdition,
  Letter,
  RunState,
  Tile,
  TileMaterial,
} from './types';
import { canAddJoker } from './vouchers';
import type { Rng } from './rng';

export type FableId =
  | 'fable1' | 'fable2' | 'fable3' | 'fable4' | 'fable5' | 'fable6'
  | 'fable7' | 'fable8' | 'fable9' | 'fable10' | 'fable11' | 'fable12'
  | 'fable13' | 'fable14' | 'fable15' | 'fable16' | 'fable17' | 'fable18';

export const FABLE_IDS: readonly FableId[] = [
  'fable1', 'fable2', 'fable3', 'fable4', 'fable5', 'fable6',
  'fable7', 'fable8', 'fable9', 'fable10', 'fable11', 'fable12',
  'fable13', 'fable14', 'fable15', 'fable16', 'fable17', 'fable18',
];

export const isFableId = (id: ConsumableId): id is FableId =>
  (FABLE_IDS as readonly ConsumableId[]).includes(id);

type FableEffect =
  | { kind: 'hint' }
  | { kind: 'copyLast' }
  | { kind: 'createFable' }
  | { kind: 'material'; material: TileMaterial; count: number }
  | { kind: 'doubleGold' }
  | { kind: 'createConstellation' }
  | { kind: 'createJoker' }
  | { kind: 'editionJoker' }
  | { kind: 'rankUp'; count: number }
  | { kind: 'jokerSellGold' }
  | { kind: 'destroy'; max: number };

export interface FableDef {
  id: FableId;
  number: number;
  effect: FableEffect;
}

export const FABLE_DEFS: readonly FableDef[] = [
  { id: 'fable1', number: 1, effect: { kind: 'hint' } },
  { id: 'fable2', number: 2, effect: { kind: 'copyLast' } },
  { id: 'fable3', number: 3, effect: { kind: 'createFable' } },
  { id: 'fable4', number: 4, effect: { kind: 'material', material: 'leadPlate', count: 2 } },
  // The canonical material roster has Stone, not Steel; Fox and Crane fills that slot.
  { id: 'fable5', number: 5, effect: { kind: 'material', material: 'stone', count: 1 } },
  { id: 'fable6', number: 6, effect: { kind: 'material', material: 'polished', count: 2 } },
  { id: 'fable7', number: 7, effect: { kind: 'material', material: 'porcelain', count: 2 } },
  { id: 'fable8', number: 8, effect: { kind: 'material', material: 'glass', count: 1 } },
  { id: 'fable9', number: 9, effect: { kind: 'doubleGold' } },
  { id: 'fable10', number: 10, effect: { kind: 'createConstellation' } },
  { id: 'fable11', number: 11, effect: { kind: 'material', material: 'ivory', count: 1 } },
  { id: 'fable12', number: 12, effect: { kind: 'material', material: 'brass', count: 1 } },
  { id: 'fable13', number: 13, effect: { kind: 'material', material: 'wood', count: 1 } },
  { id: 'fable14', number: 14, effect: { kind: 'createJoker' } },
  { id: 'fable15', number: 15, effect: { kind: 'editionJoker' } },
  { id: 'fable16', number: 16, effect: { kind: 'rankUp', count: 2 } },
  { id: 'fable17', number: 17, effect: { kind: 'jokerSellGold' } },
  { id: 'fable18', number: 18, effect: { kind: 'destroy', max: 2 } },
];

export const FABLE_REGISTRY: ReadonlyMap<FableId, FableDef> = new Map(
  FABLE_DEFS.map((def) => [def.id, def]),
);

const selectedTiles = (blind: BlindState, ids: readonly string[]): Tile[] => {
  const wanted = new Set(ids);
  return blind.hand.filter((tile) => wanted.has(tile.id));
};

const canRestoreLetter = (tile: Tile): boolean =>
  tile.material !== 'stone' || tile.letterBeforeStone !== undefined;

export function canUseFable(
  id: FableId,
  run: RunState,
  blind: BlindState,
  selectedIds: readonly string[],
): boolean {
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (!effect || !run.consumables.includes(id)) return false;
  const selected = selectedTiles(blind, selectedIds);
  if (effect.kind === 'material') {
    return selected.length === effect.count &&
      selected.every((tile) => tile.material !== effect.material) &&
      (effect.material === 'stone' || selected.every(canRestoreLetter));
  }
  if (effect.kind === 'rankUp') {
    return selected.length === effect.count && selected.every((tile) => tile.letter !== null);
  }
  if (effect.kind === 'destroy') return selected.length >= 1 && selected.length <= effect.max;
  if (effect.kind === 'copyLast') return (run.lastFableOrConstellation ?? null) !== null;
  if (effect.kind === 'createJoker') return canAddJoker(run, 'base');
  if (effect.kind === 'editionJoker') {
    return run.jokers.some((joker) => (joker.edition ?? 'base') === 'base');
  }
  return true;
}

const patchTiles = (
  run: RunState,
  blind: BlindState,
  ids: ReadonlySet<string>,
  patch: (tile: Tile) => Tile,
): { run: RunState; blind: BlindState } => {
  const map = (tiles: readonly Tile[]) => tiles.map((tile) => (ids.has(tile.id) ? patch(tile) : tile));
  return {
    run: { ...run, bag: map(run.bag) },
    blind: {
      ...blind,
      hand: map(blind.hand),
      bag: map(blind.bag),
      discardedThisBlind: map(blind.discardedThisBlind),
    },
  };
};

const toMaterial = (tile: Tile, material: TileMaterial): Tile => {
  const { woodBonusChips: _wood, ...withoutWood } = tile;
  if (material === 'stone') {
    const originalLetter = tile.letter ?? tile.letterBeforeStone;
    return {
      ...withoutWood,
      material,
      letter: null,
      ...(originalLetter ? { letterBeforeStone: originalLetter } : {}),
    };
  }
  const restored = tile.material === 'stone' ? tile.letterBeforeStone! : tile.letter;
  return {
    ...withoutWood,
    material,
    letter: restored,
    ...(material === 'wood' ? { woodBonusChips: BALANCE.materials.wood.baseChips } : {}),
  };
};

const nextLetter = (letter: Letter): Letter =>
  String.fromCharCode(letter === 'Z' ? 65 : letter.charCodeAt(0) + 1) as Letter;

const removeIds = (
  run: RunState,
  blind: BlindState,
  ids: ReadonlySet<string>,
): { run: RunState; blind: BlindState } => {
  const keep = (tiles: readonly Tile[]) => tiles.filter((tile) => !ids.has(tile.id));
  return {
    run: { ...run, bag: keep(run.bag) },
    blind: {
      ...blind,
      hand: keep(blind.hand),
      bag: keep(blind.bag),
      discardedThisBlind: keep(blind.discardedThisBlind),
    },
  };
};

const addRandomConsumables = (
  run: RunState,
  pool: readonly ConsumableId[],
  count: number,
  rng: Pick<Rng, 'int'>,
): RunState => {
  const free = Math.max(0, run.consumableSlots - run.consumables.length);
  const add = Array.from({ length: Math.min(count, free) }, () => pool[rng.int(pool.length)]!);
  return { ...run, consumables: [...run.consumables, ...add] };
};

export interface UseFableResult {
  ok: boolean;
  run: RunState;
  blind: BlindState;
  requestHint: boolean;
}

export function useFable(
  id: FableId,
  run: RunState,
  blind: BlindState,
  selectedIds: readonly string[],
  rng: Rng,
): UseFableResult {
  if (!canUseFable(id, run, blind, selectedIds)) {
    return { ok: false, run, blind, requestHint: false };
  }
  const effect = FABLE_REGISTRY.get(id)!.effect;
  const index = run.consumables.indexOf(id);
  const consumables = run.consumables.slice();
  consumables.splice(index, 1);
  let nextRun: RunState = {
    ...run,
    consumables,
    lastFableOrConstellation: id === 'fable2' ? (run.lastFableOrConstellation ?? null) : id,
  };
  let nextBlind = blind;
  let requestHint = false;

  if (effect.kind === 'hint') requestHint = true;
  else if (effect.kind === 'copyLast') {
    nextRun = { ...nextRun, consumables: [...nextRun.consumables, run.lastFableOrConstellation!] };
  } else if (effect.kind === 'createFable') {
    nextRun = addRandomConsumables(nextRun, FABLE_IDS, 2, rng);
  } else if (effect.kind === 'createConstellation') {
    nextRun = addRandomConsumables(nextRun, CONSTELLATION_IDS, 2, rng);
  } else if (effect.kind === 'material') {
    const ids = new Set(selectedIds);
    ({ run: nextRun, blind: nextBlind } = patchTiles(
      nextRun,
      nextBlind,
      ids,
      (tile) => toMaterial(tile, effect.material),
    ));
  } else if (effect.kind === 'doubleGold') {
    nextRun = { ...nextRun, gold: nextRun.gold + Math.min(nextRun.gold, 20) };
  } else if (effect.kind === 'createJoker') {
    const def = ALL_JOKERS[rng.int(ALL_JOKERS.length)]!;
    nextRun = {
      ...nextRun,
      jokers: [...nextRun.jokers, { defId: def.id, edition: 'base', state: {} }],
    };
  } else if (effect.kind === 'editionJoker') {
    const eligible = nextRun.jokers
      .map((joker, index) => ({ joker, index }))
      .filter(({ joker }) => (joker.edition ?? 'base') === 'base');
    if (rng.next() < 0.25) {
      const target = eligible[rng.int(eligible.length)]!;
      const editions: readonly JokerEdition[] = ['foil', 'holographic', 'polychrome'];
      const jokers = nextRun.jokers.slice();
      jokers[target.index] = { ...target.joker, edition: editions[rng.int(editions.length)]! };
      nextRun = { ...nextRun, jokers };
    }
  } else if (effect.kind === 'rankUp') {
    const ids = new Set(selectedIds);
    ({ run: nextRun, blind: nextBlind } = patchTiles(nextRun, nextBlind, ids, (tile) => ({
      ...tile,
      letter: nextLetter(tile.letter!),
      ...(tile.letterBeforeStone ? { letterBeforeStone: nextLetter(tile.letterBeforeStone) } : {}),
    })));
  } else if (effect.kind === 'jokerSellGold') {
    const total = nextRun.jokers.reduce((sum, owned) => {
      const def = JOKER_REGISTRY.get(owned.defId);
      return sum + sellValue(def ? BALANCE.jokerPrice[def.rarity] : 0);
    }, 0);
    nextRun = { ...nextRun, gold: nextRun.gold + Math.min(total, 50) };
  } else if (effect.kind === 'destroy') {
    ({ run: nextRun, blind: nextBlind } = removeIds(nextRun, nextBlind, new Set(selectedIds)));
  }

  return { ok: true, run: nextRun, blind: nextBlind, requestHint };
}
