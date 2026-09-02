/**
 * Materials (GDD §2.2) — the enhancement layer, as data + hooks.
 *
 * Mirrors the joker (events.ts JokerBus) and boss (BOSS_REGISTRY) patterns: a
 * material never hard-codes itself into pipeline code. Three hooks map to the
 * three firing points:
 *   - onTileScored        → per PLAYED tile, during word scoring
 *   - onHeldDuringScoring → per tile REMAINING in hand, during word scoring
 *   - onHeldAtBlindEnd    → per tile remaining in hand at blind end
 *
 * Numbers live in BALANCE.materials. `ceramic` is the base and registers nothing.
 * Display names are i18n-only (`material.*` in locales) — a MaterialDef carries no
 * name, so there is exactly one place a material can be renamed.
 */

import { BALANCE } from './balance';
import type { Rng } from './rng';
import type { ChanceResult, Tile, TileMaterial, WordScoringContext } from './types';

/** Apply one material axis while preserving Stone's hidden letter contract. */
export const setTileMaterial = (tile: Tile, material: TileMaterial): Tile => {
  const { woodBonusChips: _wood, ...withoutWood } = tile;
  if (material === 'stone') {
    const originalLetter = tile.letter ?? tile.letterBeforeStone;
    return {
      ...withoutWood,
      material,
      letter: null,
      font: 'medium',
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

/** Permanently advance one Wood tile after it scored in a play. */
export const growWoodTile = (tile: Tile): Tile => tile.material === 'wood'
  ? {
      ...tile,
      woodBonusChips:
        (tile.woodBonusChips ?? BALANCE.materials.wood.baseChips)
        + BALANCE.materials.wood.chipsPerPlay,
    }
  : tile;

/** Outcomes a material can produce beyond chips/mult. */
export interface MaterialSideEffects {
  /** run gold to add (Ivory, Lead plate) */
  goldDelta?: number;
  /** remove this tile from the run's bag permanently (Glass) */
  destroy?: boolean;
  /** Wood grows once per play, after its current bonus scores. */
  growWood?: boolean;
  /** Actual seeded outcomes, replayed verbatim by the UI. */
  chanceResults?: ChanceResult[];
}

export interface MaterialDef {
  id: TileMaterial;
  /** Preserve multiplicative scoring semantics in settle presentation. */
  multFactor?: number;
  onTileScored?(ctx: WordScoringContext, tile: Tile, rng: Rng): MaterialSideEffects | void;
  onHeldDuringScoring?(ctx: WordScoringContext, tile: Tile): void;
  onHeldAtBlindEnd?(tile: Tile): MaterialSideEffects | void;
}

const porcelain: MaterialDef = {
  id: 'porcelain',
  onTileScored: (ctx) => {
    ctx.chips += BALANCE.materials.porcelain.chips;
  },
};

const polished: MaterialDef = {
  id: 'polished',
  onTileScored: (ctx) => {
    ctx.mult += BALANCE.materials.polished.mult;
  },
};

const wood: MaterialDef = {
  id: 'wood',
  onTileScored: (ctx, tile) => {
    ctx.chips += tile.woodBonusChips ?? BALANCE.materials.wood.baseChips;
    return { growWood: true };
  },
};

const stone: MaterialDef = {
  id: 'stone',
  // The letterless-ness lives in the Tile itself (letter: null), which forces the
  // word to gibberish via the lexicon. Here Stone only pays its chips.
  onTileScored: (ctx) => {
    ctx.chips += BALANCE.materials.stone.chips;
  },
};

const leadPlate: MaterialDef = {
  id: 'leadPlate',
  // A worn stereotype plate prints unevenly — same plate, uneven pulls.
  // The two rolls are INDEPENDENT (Balatro Lucky): one tile can hit both.
  onTileScored: (ctx, _tile, rng) => {
    const cfg = BALANCE.materials.leadPlate;
    const multHit = rng.next() < cfg.multChance;
    const goldHit = rng.next() < cfg.goldChance;
    if (multHit) ctx.mult += cfg.mult;
    return {
      ...(goldHit ? { goldDelta: cfg.gold } : {}),
      chanceResults: [
        { chance: cfg.multChance, label: 'mult', outcome: multHit ? 'success' : 'failure' },
        { chance: cfg.goldChance, label: 'gold', outcome: goldHit ? 'success' : 'failure' },
      ],
    };
  },
};

const glass: MaterialDef = {
  id: 'glass',
  multFactor: BALANCE.materials.glass.multFactor,
  // The ×2 ALWAYS lands on the word that breaks it — the destroy roll is reported
  // as a side effect and applied by the caller after the word settles (GDD §2.2).
  onTileScored: (ctx, _tile, rng) => {
    const cfg = BALANCE.materials.glass;
    ctx.mult *= cfg.multFactor;
    const destroy = rng.next() < cfg.destroyChance;
    return {
      ...(destroy ? { destroy: true } : {}),
      chanceResults: [{
        chance: cfg.destroyChance,
        label: 'destruction',
        outcome: destroy ? 'destroyed' : 'survived',
      }],
    };
  },
};

const brass: MaterialDef = {
  id: 'brass',
  multFactor: BALANCE.materials.brass.multFactor,
  // Type metal that stays in the case: pays while it is NOT played.
  onHeldDuringScoring: (ctx) => {
    ctx.mult *= BALANCE.materials.brass.multFactor;
  },
};

const ivory: MaterialDef = {
  id: 'ivory',
  onHeldAtBlindEnd: () => ({ goldDelta: BALANCE.materials.ivory.gold }),
};

export const MATERIAL_REGISTRY: ReadonlyMap<TileMaterial, MaterialDef> = new Map(
  [porcelain, polished, stone, leadPlate, glass, brass, ivory, wood].map((m) => [m.id, m]),
);

/**
 * Apply one played tile's material, capturing chips/mult deltas as a ScoreEvent
 * the UI can replay. Returns null when the material has no scoring effect, so
 * callers can skip emitting a no-op beat.
 */
export function applyTileMaterial(
  ctx: WordScoringContext,
  tile: Tile,
  rng: Rng,
): { chipsDelta: number; multDelta: number; multFactor?: number; side: MaterialSideEffects } | null {
  const def = MATERIAL_REGISTRY.get(tile.material);
  if (!def?.onTileScored) return null;
  const beforeChips = ctx.chips;
  const beforeMult = ctx.mult;
  const side = def.onTileScored(ctx, tile, rng) ?? {};
  return {
    chipsDelta: ctx.chips - beforeChips,
    multDelta: ctx.mult - beforeMult,
    ...(def.multFactor !== undefined ? { multFactor: def.multFactor } : {}),
    side,
  };
}

/**
 * Apply the materials of tiles REMAINING in hand (Brass). Fires once per held
 * tile, per word. Returns one delta record per tile that actually moved the
 * numbers, for the UI settle log.
 */
export function applyHeldMaterials(
  ctx: WordScoringContext,
  held: readonly Tile[],
): { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number; multFactor?: number }[] {
  const out: { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number; multFactor?: number }[] = [];
  for (const tile of held) {
    const def = MATERIAL_REGISTRY.get(tile.material);
    if (!def?.onHeldDuringScoring) continue;
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    def.onHeldDuringScoring(ctx, tile);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      out.push({
        material: tile.material,
        tileId: tile.id,
        chipsDelta,
        multDelta,
        ...(def.multFactor !== undefined ? { multFactor: def.multFactor } : {}),
      });
    }
  }
  return out;
}

/** Total gold from materials on tiles still in hand at blind end (Ivory). Pure. */
export function collectBlindEndMaterials(held: readonly Tile[]): number {
  let gold = 0;
  for (const tile of held) {
    const def = MATERIAL_REGISTRY.get(tile.material);
    if (!def?.onHeldAtBlindEnd) continue;
    gold += (def.onHeldAtBlindEnd(tile) ?? {}).goldDelta ?? 0;
  }
  return gold;
}
