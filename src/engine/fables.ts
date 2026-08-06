/**
 * Fable cards — one-shot run mutations. Pure/headless: the UI supplies the
 * currently staged tile ids and a seeded RNG, then renders the returned state.
 */
import { BALANCE } from './balance';
import { CONSTELLATION_IDS } from './constellations';
import { emojiTileSellValue } from './economy';
import {
  ALL_JOKERS,
  createOwnedJoker,
  JOKER_REGISTRY,
  onTilesDestroyed,
  onTilesEnhanced,
} from './jokers';
import type {
  BlindState,
  ChanceResult,
  ConsumableId,
  JokerEdition,
  Letter,
  RunState,
  Tile,
  TileMaterial,
} from './types';
import { canAddJoker } from './vouchers';
import type { Rng } from './rng';
import { setTileMaterial } from './materials';

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

/**
 * True when a consumable's effect is only meaningful INSIDE a blind — currently just
 * the `hint` effect (Magnifier / Fable 1), which highlights spellable words in the live
 * hand. The shop hides its instant-use and disables its Use button (feedback 2026-07-28).
 */
export function isBlindOnlyConsumable(id: ConsumableId): boolean {
  if (id === 'magnifier') return true;
  return isFableId(id) && FABLE_REGISTRY.get(id)?.effect.kind === 'hint';
}

/** True when a Fable's effect targets specific letter tiles (material / rank-up /
 *  destroy). Shop copies may only be bought and held for a blind; Fable/Ink Packs
 *  expose their dealt pouch candidates directly. */
export function fableTargetsTiles(id: ConsumableId): boolean {
  if (!isFableId(id)) return false;
  const kind = FABLE_REGISTRY.get(id)?.effect.kind;
  return kind === 'material' || kind === 'rankUp' || kind === 'destroy';
}

/** How many tiles the player must pick for a tile-targeting Fable. */
export function fablePickCount(id: FableId): { min: number; max: number } {
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (effect?.kind === 'material' || effect?.kind === 'rankUp') return { min: 1, max: effect.count };
  if (effect?.kind === 'destroy') return { min: 1, max: effect.max };
  return { min: 0, max: 0 };
}

/** Live payout shared by The Heavenly Maiden and the Woodcutter's tooltip and
 * effect resolution, so the displayed amount can never drift from the award. */
export const jokerSellGoldValue = (run: RunState): number =>
  Math.min(
    run.jokers.reduce((sum, owned) => {
      const def = JOKER_REGISTRY.get(owned.defId);
      return sum + (def
        ? emojiTileSellValue(
            run,
            BALANCE.jokerPrice[def.rarity],
            owned.edition ?? 'base',
            owned.state.sellBonus ?? 0,
          )
        : 1);
    }, 0),
    50,
  );

/**
 * Apply a tile-targeting Fable to tiles in the POUCH (run.bag) by id — the Fable/Ink Pack
 * candidate path, where there is no live hand. Mirrors the in-blind effects (toMaterial
 * / rank-up / destroy) but patches only run.bag, and consumes the card. Returns ok:false
 * (unchanged run) if the selection is invalid.
 */
export function useFableOnPouch(
  id: FableId,
  run: RunState,
  tileIds: readonly string[],
): { ok: boolean; run: RunState } {
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (!effect || !canUseFableOnPouch(id, run, tileIds)) return { ok: false, run };
  const ids = new Set(tileIds);
  const consumed = (): ConsumableId[] => {
    const c = run.consumables.slice();
    c.splice(c.indexOf(id), 1);
    return c;
  };
  const commit = (bag: Tile[]): { ok: true; run: RunState } => ({
    ok: true,
    run: { ...run, bag, consumables: consumed(), lastFableOrConstellation: id },
  });

  if (effect.kind === 'material') {
    const result = commit(
      run.bag.map((t) => (ids.has(t.id) ? setTileMaterial(t, effect.material) : t)),
    );
    return { ...result, run: onTilesEnhanced(result.run, ids.size) };
  }
  if (effect.kind === 'rankUp') {
    return commit(
      run.bag.map((t) =>
        ids.has(t.id)
          ? {
              ...t,
              letter: nextLetter(t.letter!),
              ...(t.letterBeforeStone ? { letterBeforeStone: nextLetter(t.letterBeforeStone) } : {}),
            }
          : t,
      ),
    );
  }
  if (effect.kind === 'destroy') {
    const result = commit(run.bag.filter((t) => !ids.has(t.id)));
    return { ...result, run: onTilesDestroyed(result.run, ids.size) };
  }
  return { ok: false, run };
}

/** Pure validation twin of useFableOnPouch, used to gate a pack's Use button. */
export function canUseFableOnPouch(
  id: FableId,
  run: RunState,
  tileIds: readonly string[],
): boolean {
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (!effect || !run.consumables.includes(id)) return false;
  const ids = new Set(tileIds);
  const targets = run.bag.filter((tile) => ids.has(tile.id));
  if (targets.length !== tileIds.length) return false;
  if (effect.kind === 'material') {
    return tileIds.length >= 1 && tileIds.length <= effect.count &&
      targets.every((tile) => tile.material !== effect.material) &&
      (effect.material === 'stone' || targets.every(canRestoreLetter));
  }
  if (effect.kind === 'rankUp') {
    return tileIds.length >= 1 && tileIds.length <= effect.count &&
      targets.every((tile) => tile.letter !== null);
  }
  return effect.kind === 'destroy' && tileIds.length >= 1 && tileIds.length <= effect.max;
}

export function canUseFable(
  id: FableId,
  run: RunState,
  blind: BlindState,
  selectedIds: readonly string[],
  profileEligible?: ReadonlySet<string>,
): boolean {
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (!effect || !run.consumables.includes(id)) return false;
  const selected = selectedTiles(blind, selectedIds);
  if (effect.kind === 'material') {
    return selected.length >= 1 && selected.length <= effect.count &&
      selected.every((tile) => tile.material !== effect.material) &&
      (effect.material === 'stone' || selected.every(canRestoreLetter));
  }
  if (effect.kind === 'rankUp') {
    return selected.length >= 1 && selected.length <= effect.count &&
      selected.every((tile) => tile.letter !== null);
  }
  if (effect.kind === 'destroy') return selected.length >= 1 && selected.length <= effect.max;
  if (effect.kind === 'copyLast') {
    return (run.lastFableOrConstellation ?? null) !== null &&
      run.consumables.length <= run.consumableSlots;
  }
  if (effect.kind === 'createFable' || effect.kind === 'createConstellation') {
    // A held card frees its own slot as it resolves. A pack-use card is staged
    // temporarily; if that pushes the list over capacity, there is no destination
    // slot for the created card and the action must remain disabled.
    return run.consumables.length <= run.consumableSlots;
  }
  if (effect.kind === 'createJoker') {
    return ALL_JOKERS.some((def) =>
      def.rarity !== 'legendary' && canAddJoker(run, def.id, 'base', profileEligible),
    );
  }
  if (effect.kind === 'editionJoker') {
    return run.jokers.some((joker) => (joker.edition ?? 'base') === 'base');
  }
  return true;
}

/**
 * Whether a Fable selected inside an opened pack can resolve now. Pack-use cards
 * are staged temporarily so ordinary data-driven preconditions remain the single
 * source of truth. Blind-only cards are selected into a held slot instead.
 */
export function canUseFableFromPack(
  id: FableId,
  run: RunState,
  blind: BlindState,
  tileIds: readonly string[],
  profileEligible?: ReadonlySet<string>,
): boolean {
  if (isBlindOnlyConsumable(id)) return run.consumables.length < run.consumableSlots;
  return fableTargetsTiles(id)
    ? canUseFableOnPouch(id, { ...run, consumables: [...run.consumables, id] }, tileIds)
    : canUseUnheldFable(id, run, blind, profileEligible);
}

/** Gate an offered Fable before it is paid for and temporarily staged for use. */
export function canUseUnheldFable(
  id: FableId,
  run: RunState,
  blind: BlindState,
  profileEligible?: ReadonlySet<string>,
): boolean {
  return canUseFable(
    id,
    { ...run, consumables: [...run.consumables, id] },
    blind,
    [],
    profileEligible,
  );
}

/** Rewrite every copy of the given tile ids wherever they live — the run's
 *  permanent pouch and every in-blind list. Shared with Gambler cards, which
 *  target the same "active tile field" by id (GDD §10.3). */
export const patchTiles = (
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

const nextLetter = (letter: Letter): Letter =>
  String.fromCharCode(letter === 'Z' ? 65 : letter.charCodeAt(0) + 1) as Letter;

/** Presentation preview for a tile-targeting Fable before the mutation commits. */
export function previewFableTile(id: FableId, tile: Tile): Tile {
  const effect = FABLE_REGISTRY.get(id)?.effect;
  if (effect?.kind === 'material') return setTileMaterial(tile, effect.material);
  if (effect?.kind === 'rankUp' && tile.letter !== null) {
    return {
      ...tile,
      letter: nextLetter(tile.letter),
      ...(tile.letterBeforeStone
        ? { letterBeforeStone: nextLetter(tile.letterBeforeStone) }
        : {}),
    };
  }
  return tile;
}

/** Twin of `patchTiles` for permanent removal. */
export const removeIds = (
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
  chanceResults: ChanceResult[];
}

export function useFable(
  id: FableId,
  run: RunState,
  blind: BlindState,
  selectedIds: readonly string[],
  rng: Rng,
  profileEligible?: ReadonlySet<string>,
): UseFableResult {
  if (!canUseFable(id, run, blind, selectedIds, profileEligible)) {
    return { ok: false, run, blind, requestHint: false, chanceResults: [] };
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
  const chanceResults: ChanceResult[] = [];

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
      (tile) => setTileMaterial(tile, effect.material),
    ));
    nextRun = onTilesEnhanced(nextRun, selectedIds.length);
  } else if (effect.kind === 'doubleGold') {
    nextRun = { ...nextRun, gold: nextRun.gold + Math.min(nextRun.gold, 20) };
  } else if (effect.kind === 'createJoker') {
    const available = ALL_JOKERS.filter((def) =>
      def.rarity !== 'legendary' && canAddJoker(nextRun, def.id, 'base', profileEligible),
    );
    const def = available[rng.int(available.length)]!;
    nextRun = {
      ...nextRun,
      jokers: [...nextRun.jokers, createOwnedJoker(nextRun, def.id)],
    };
  } else if (effect.kind === 'editionJoker') {
    const eligible = nextRun.jokers
      .map((joker, index) => ({ joker, index }))
      .filter(({ joker }) => (joker.edition ?? 'base') === 'base');
    const chance = BALANCE.fables.cowherdEditionChance;
    const success = rng.next() < chance;
    chanceResults.push({ chance, label: 'edition', outcome: success ? 'success' : 'failure' });
    if (success) {
      const target = eligible[rng.int(eligible.length)]!;
      const editions: readonly JokerEdition[] = ['gray', 'violet', 'rainbow'];
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
    nextRun = { ...nextRun, gold: nextRun.gold + jokerSellGoldValue(nextRun) };
  } else if (effect.kind === 'destroy') {
    ({ run: nextRun, blind: nextBlind } = removeIds(nextRun, nextBlind, new Set(selectedIds)));
    nextRun = onTilesDestroyed(nextRun, selectedIds.length);
  }

  return { ok: true, run: nextRun, blind: nextBlind, requestHint, chanceResults };
}
