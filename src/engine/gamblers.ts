/**
 * Gambler cards (GDD §10.3) — the Spectral analog: rare, powerful, usually
 * double-edged. Native source is the Ink Pack (§9.3); Comic Book lets one
 * ordinary card replace a Fable-Pack choice. Deer and Phoenix are Ink-only.
 *
 * All fourteen supplied effects are implemented through this registry.
 *
 * Headless, like every other engine module: the caller supplies the active tile
 * field (the live hand during a blind, the pack's seeded pouch candidates inside
 * an opened pack) and a seeded RNG.
 */
import { BALANCE } from './balance';
import { GAMBLER_IDS, isGamblerId, type GamblerId } from './gamblerIds';
import { patchTiles, removeIds } from './fables';
import {
  createOwnedJoker,
  LEGENDARY_JOKERS,
  RARE_JOKERS,
  onTilesCreated,
  onTilesDestroyed,
  onTilesEnhanced,
} from './jokers';
import type { Rng } from './rng';
import type {
  BlindState,
  ConsumableId,
  JokerEdition,
  JokerRarity,
  Letter,
  PatternId,
  RunState,
  Tile,
  TileEdition,
  TileFont,
  TileMaterial,
} from './types';
import { canAddJoker } from './vouchers';

// The id space lives in a leaf module so `pouches.ts` can read it without
// importing this file (and, through it, every joker) — see gamblerIds.ts.
// Re-exported here so every existing call site keeps its import path.
export { GAMBLER_IDS, isGamblerId, type GamblerId } from './gamblerIds';

type GamblerEffect =
  /** #1/#4/#7/#11 — retype one selected tile; every other axis is preserved. */
  | { kind: 'font'; font: TileFont }
  /** #2 Boar — keep one Emoji Tile plus a copy, destroy the rest. */
  | { kind: 'copyJoker' }
  /** #3 Bridge — one shared random letter across the field, then hand size −1. */
  | { kind: 'unifyLetters' }
  /** #5 Butterflies — destroy N random field tiles for gold. */
  | { kind: 'destroyForGold' }
  /** #6 Crane and Sun / #12 Phoenix — create an unowned Emoji Tile of a rarity. */
  | { kind: 'createJoker'; rarity: JokerRarity; zeroGold?: true }
  /** #8 Curtain — permanent copies of one selected tile. */
  | { kind: 'copyTile' }
  /** #9 Deer — every sentence pattern +1 level. */
  | { kind: 'levelAllPatterns' }
  /** #10 Full Moon — destroy one random field tile, create enhanced vowels. */
  | { kind: 'moonVowels' }
  /** #13/#14 — apply an Emoji Tile edition, optionally paying a permanent cost
   *  or destroying every other Emoji Tile. */
  | {
      kind: 'jokerEdition';
      edition: Exclude<JokerEdition, 'base'>;
      handSizeLoss?: number;
      destroyOthers?: true;
    };

export interface GamblerDef {
  id: GamblerId;
  /** number in the GDD §10.3 table, for cross-referencing */
  number: number;
  effect: GamblerEffect;
}

export const GAMBLER_DEFS: readonly GamblerDef[] = [
  { id: 'barnSwallow', number: 1, effect: { kind: 'font', font: 'black' } },
  { id: 'boar', number: 2, effect: { kind: 'copyJoker' } },
  { id: 'bridge', number: 3, effect: { kind: 'unifyLetters' } },
  { id: 'bushWarbler', number: 4, effect: { kind: 'font', font: 'lightItalic' } },
  { id: 'butterflies', number: 5, effect: { kind: 'destroyForGold' } },
  { id: 'craneAndSun', number: 6, effect: { kind: 'createJoker', rarity: 'rare', zeroGold: true } },
  { id: 'cuckoo', number: 7, effect: { kind: 'font', font: 'inline' } },
  { id: 'curtain', number: 8, effect: { kind: 'copyTile' } },
  { id: 'deer', number: 9, effect: { kind: 'levelAllPatterns' } },
  { id: 'fullMoon', number: 10, effect: { kind: 'moonVowels' } },
  { id: 'geese', number: 11, effect: { kind: 'font', font: 'bold' } },
  { id: 'phoenix', number: 12, effect: { kind: 'createJoker', rarity: 'legendary' } },
  {
    id: 'rainman',
    number: 13,
    effect: {
      kind: 'jokerEdition',
      edition: 'white',
      handSizeLoss: BALANCE.gambler.rainmanHandSizeLoss,
    },
  },
  {
    id: 'sakeCup',
    number: 14,
    effect: { kind: 'jokerEdition', edition: 'rainbow', destroyOthers: true },
  },
];

export const GAMBLER_REGISTRY: ReadonlyMap<GamblerId, GamblerDef> = new Map(
  GAMBLER_DEFS.map((def) => [def.id, def]),
);

const POOL_BY_RARITY: Record<'rare' | 'legendary', typeof RARE_JOKERS> = {
  rare: RARE_JOKERS,
  legendary: LEGENDARY_JOKERS,
};

/** Non-base enhancement pools for Full Moon. Stone is excluded because it would
 * erase the vowel the card promises (GDD §10.3 #10). */
const VOWEL_MATERIALS: readonly TileMaterial[] = [
  'porcelain', 'polished', 'glass', 'leadPlate', 'ivory', 'brass', 'wood',
];
const VOWEL_FONTS: readonly TileFont[] = ['lightItalic', 'bold', 'inline', 'black'];
const VOWEL_EDITIONS: readonly TileEdition[] = ['gray', 'violet', 'rainbow'];
const VOWEL_ENHANCEMENT_AXES = ['material', 'font', 'edition'] as const;
const VOWEL_LETTERS: readonly Letter[] = ['A', 'E', 'I', 'O', 'U'];
const ALPHABET: readonly Letter[] = Object.keys(BALANCE.bagComposition) as Letter[];

/** True when this card asks the player to pick tiles from the active field. */
export function gamblerTargetsTiles(id: ConsumableId): boolean {
  if (!isGamblerId(id)) return false;
  const kind = GAMBLER_REGISTRY.get(id)!.effect.kind;
  return kind === 'font' || kind === 'copyTile';
}

/** How many field tiles the player must pick. Cards that roll their own targets
 *  (Bridge, Butterflies, Full Moon) ask for none. */
export function gamblerPickCount(id: GamblerId): { min: number; max: number } {
  return gamblerTargetsTiles(id) ? { min: 1, max: 1 } : { min: 0, max: 0 };
}

const fieldTiles = (field: readonly Tile[], ids: readonly string[]): Tile[] => {
  const wanted = new Set(ids);
  return field.filter((tile) => wanted.has(tile.id));
};

const newTileId = (rng: Rng, index: number): string => `gb${rng.int(1_000_000)}-${index}`;

const jokerEditionTargetIndexes = (
  run: RunState,
  edition: Exclude<JokerEdition, 'base'>,
): number[] =>
  run.jokers.flatMap((joker, index) =>
    (joker.edition ?? 'base') === edition ? [] : [index],
  );

/** Pure precondition twin of `useGambler`; also gates the pack's Use button. */
export function canUseGambler(
  id: GamblerId,
  run: RunState,
  field: readonly Tile[],
  selectedIds: readonly string[],
  profileEligible?: ReadonlySet<string>,
): boolean {
  const effect = GAMBLER_REGISTRY.get(id)?.effect;
  if (!effect || !run.consumables.includes(id)) return false;
  const selected = fieldTiles(field, selectedIds);
  if (selected.length !== selectedIds.length) return false;

  switch (effect.kind) {
    case 'font':
      return selected.length === 1 && selected[0]!.material !== 'stone' &&
        selected[0]!.font !== effect.font;
    case 'copyTile':
      return selected.length === 1;
    case 'copyJoker':
      return run.jokers.length > 0;
    case 'jokerEdition':
      return jokerEditionTargetIndexes(run, effect.edition).length > 0 &&
        (!effect.handSizeLoss || run.handSize > 1);
    case 'unifyLetters':
      return field.length > 0 && run.handSize > BALANCE.gambler.bridgeHandSizeFloor;
    case 'destroyForGold':
      return field.length >= BALANCE.gambler.butterfliesDestroy;
    case 'moonVowels':
      return field.length >= BALANCE.gambler.fullMoonDestroy;
    case 'createJoker':
      return POOL_BY_RARITY[effect.rarity as 'rare' | 'legendary'].some((def) =>
        canAddJoker(
          run,
          def.id,
          'base',
          effect.rarity === 'legendary' ? undefined : profileEligible,
        ),
      );
    case 'levelAllPatterns':
      return true;
  }
}

/** Gate an offered Gambler before it is staged for use inside a pack. */
export const canUseUnheldGambler = (
  id: GamblerId,
  run: RunState,
  field: readonly Tile[],
  selectedIds: readonly string[],
  profileEligible?: ReadonlySet<string>,
): boolean =>
  canUseGambler(
    id,
    { ...run, consumables: [...run.consumables, id] },
    field,
    selectedIds,
    profileEligible,
  );

/** Presentation preview for a tile-targeting Gambler before the mutation commits. */
export function previewGamblerTile(id: GamblerId, tile: Tile): Tile {
  const effect = GAMBLER_REGISTRY.get(id)?.effect;
  return effect?.kind === 'font' && tile.material !== 'stone'
    ? { ...tile, font: effect.font }
    : tile;
}

export interface UseGamblerResult {
  ok: boolean;
  run: RunState;
  blind: BlindState;
}

/**
 * Resolve one Gambler card. `field` is the ACTIVE TILE FIELD (GDD §10.3): the
 * live hand during a blind, or the opened pack's seeded pouch candidates. Tile
 * edits are applied by id through the shared Fable helpers, so the run's pouch
 * and every in-blind list stay consistent on either path.
 */
export function useGambler(
  id: GamblerId,
  run: RunState,
  blind: BlindState,
  field: readonly Tile[],
  selectedIds: readonly string[],
  rng: Rng,
  profileEligible?: ReadonlySet<string>,
): UseGamblerResult {
  if (!canUseGambler(id, run, field, selectedIds, profileEligible)) {
    return { ok: false, run, blind };
  }
  const effect = GAMBLER_REGISTRY.get(id)!.effect;
  const consumables = run.consumables.slice();
  consumables.splice(consumables.indexOf(id), 1);
  let nextRun: RunState = { ...run, consumables };
  let nextBlind = blind;

  switch (effect.kind) {
    case 'font': {
      // Only non-Stone tiles can carry a font enhancement.
      ({ run: nextRun, blind: nextBlind } = patchTiles(
        nextRun,
        nextBlind,
        new Set(selectedIds),
        (tile) => tile.material === 'stone' ? tile : { ...tile, font: effect.font },
      ));
      nextRun = onTilesEnhanced(nextRun, selectedIds.length);
      break;
    }
    case 'copyTile': {
      const source = fieldTiles(field, selectedIds)[0]!;
      const copies = Array.from(
        { length: BALANCE.gambler.curtainCopies },
        (_, i): Tile => ({ ...source, id: newTileId(rng, i) }),
      );
      nextRun = { ...nextRun, bag: [...nextRun.bag, ...copies] };
      break;
    }
    case 'copyJoker': {
      // The explicit exception to unique Emoji Tile ownership (GDD §10.3 #2).
      const kept = nextRun.jokers[rng.int(nextRun.jokers.length)]!;
      const edition = kept.edition ?? 'base';
      const copy = {
        ...kept,
        // Gray/Violet/Rainbow copy; a White original yields a Base copy.
        edition: edition === 'white' ? ('base' as const) : edition,
        state: { ...kept.state },
      };
      nextRun = { ...nextRun, jokers: [kept, copy] };
      break;
    }
    case 'jokerEdition': {
      const targets = jokerEditionTargetIndexes(nextRun, effect.edition);
      const chosen = targets[rng.int(targets.length)]!;
      const enhanced = { ...nextRun.jokers[chosen]!, edition: effect.edition };
      nextRun = {
        ...nextRun,
        jokers: effect.destroyOthers
          ? [enhanced]
          : nextRun.jokers.map((joker, index) => index === chosen ? enhanced : joker),
        handSize: effect.handSizeLoss
          ? Math.max(1, nextRun.handSize - effect.handSizeLoss)
          : nextRun.handSize,
      };
      break;
    }
    case 'unifyLetters': {
      const letter = ALPHABET[rng.int(ALPHABET.length)]!;
      const ids = new Set(field.map((tile) => tile.id));
      ({ run: nextRun, blind: nextBlind } = patchTiles(nextRun, nextBlind, ids, (tile) =>
        // A Stone tile keeps its letterless face; the remembered letter changes.
        tile.material === 'stone'
          ? { ...tile, letterBeforeStone: letter }
          : { ...tile, letter },
      ));
      nextRun = {
        ...nextRun,
        handSize: Math.max(BALANCE.gambler.bridgeHandSizeFloor, nextRun.handSize - 1),
      };
      break;
    }
    case 'destroyForGold': {
      const doomed = rng.shuffle(field).slice(0, BALANCE.gambler.butterfliesDestroy);
      ({ run: nextRun, blind: nextBlind } = removeIds(
        nextRun,
        nextBlind,
        new Set(doomed.map((tile) => tile.id)),
      ));
      nextRun = onTilesDestroyed(
        { ...nextRun, gold: nextRun.gold + BALANCE.gambler.butterfliesGold },
        doomed.length,
      );
      break;
    }
    case 'moonVowels': {
      const doomed = rng.shuffle(field).slice(0, BALANCE.gambler.fullMoonDestroy);
      ({ run: nextRun, blind: nextBlind } = removeIds(
        nextRun,
        nextBlind,
        new Set(doomed.map((tile) => tile.id)),
      ));
      const born = Array.from({ length: BALANCE.gambler.fullMoonVowels }, (_, i): Tile => {
        const axis = VOWEL_ENHANCEMENT_AXES[rng.int(VOWEL_ENHANCEMENT_AXES.length)]!;
        return {
          id: newTileId(rng, i),
          letter: VOWEL_LETTERS[rng.int(VOWEL_LETTERS.length)]!,
          material: axis === 'material'
            ? VOWEL_MATERIALS[rng.int(VOWEL_MATERIALS.length)]!
            : 'ceramic',
          font: axis === 'font' ? VOWEL_FONTS[rng.int(VOWEL_FONTS.length)]! : 'medium',
          edition: axis === 'edition'
            ? VOWEL_EDITIONS[rng.int(VOWEL_EDITIONS.length)]!
            : 'base',
        };
      });
      nextRun = onTilesCreated(
        onTilesDestroyed({ ...nextRun, bag: [...nextRun.bag, ...born] }, doomed.length),
        born.length,
      );
      break;
    }
    case 'createJoker': {
      const pool = POOL_BY_RARITY[effect.rarity as 'rare' | 'legendary'].filter((def) =>
        canAddJoker(
          nextRun,
          def.id,
          'base',
          effect.rarity === 'legendary' ? undefined : profileEligible,
        ),
      );
      const def = pool[rng.int(pool.length)]!;
      nextRun = {
        ...nextRun,
        jokers: [...nextRun.jokers, createOwnedJoker(nextRun, def.id)],
        ...(effect.zeroGold ? { gold: 0 } : {}),
      };
      break;
    }
    case 'levelAllPatterns': {
      const levels = { ...nextRun.patternLevels };
      for (const pattern of Object.keys(levels) as PatternId[]) levels[pattern] += 1;
      nextRun = { ...nextRun, patternLevels: levels };
      break;
    }
  }

  return { ok: true, run: nextRun, blind: nextBlind };
}
