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
 * Numbers live in BALANCE.materials. Ceramic is the base and registers nothing.
 */

import { BALANCE } from './balance';
import type { Rng } from './rng';
import type { Tile, TileMaterial, WordScoringContext } from './types';

/** Outcomes a material can produce beyond chips/mult. */
export interface MaterialSideEffects {
  /** run gold to add (Ivory, Lead plate) */
  goldDelta?: number;
  /** remove this tile from the run's bag permanently (Glass) */
  destroy?: boolean;
}

export interface MaterialDef {
  id: TileMaterial;
  nameKo: string;
  nameEn: string;
  onTileScored?(ctx: WordScoringContext, tile: Tile, rng: Rng): MaterialSideEffects | void;
  onHeldDuringScoring?(ctx: WordScoringContext, tile: Tile): void;
  onHeldAtBlindEnd?(tile: Tile): MaterialSideEffects | void;
}

const porcelain: MaterialDef = {
  id: 'porcelain',
  nameKo: '자기',
  nameEn: 'Porcelain',
  onTileScored: (ctx) => {
    ctx.chips += BALANCE.materials.porcelain.chips;
  },
};

const polished: MaterialDef = {
  id: 'polished',
  nameKo: '연마',
  nameEn: 'Polished',
  onTileScored: (ctx) => {
    ctx.mult += BALANCE.materials.polished.mult;
  },
};

const stone: MaterialDef = {
  id: 'stone',
  nameKo: '석재',
  nameEn: 'Stone',
  // The letterless-ness lives in the Tile itself (letter: null), which forces the
  // word to gibberish via the lexicon. Here Stone only pays its chips.
  onTileScored: (ctx) => {
    ctx.chips += BALANCE.materials.stone.chips;
  },
};

const leadPlate: MaterialDef = {
  id: 'leadPlate',
  nameKo: '연판',
  nameEn: 'Lead plate',
  // A worn stereotype plate prints unevenly — same plate, uneven pulls.
  // The two rolls are INDEPENDENT (Balatro Lucky): one tile can hit both.
  onTileScored: (ctx, _tile, rng) => {
    const cfg = BALANCE.materials.leadPlate;
    if (rng.next() < cfg.multChance) ctx.mult += cfg.mult;
    return rng.next() < cfg.goldChance ? { goldDelta: cfg.gold } : {};
  },
};

const glass: MaterialDef = {
  id: 'glass',
  nameKo: '유리',
  nameEn: 'Glass',
  // The ×2 ALWAYS lands on the word that breaks it — the destroy roll is reported
  // as a side effect and applied by the caller after the word settles (GDD §2.2).
  onTileScored: (ctx, _tile, rng) => {
    const cfg = BALANCE.materials.glass;
    ctx.mult *= cfg.multFactor;
    return rng.next() < cfg.destroyChance ? { destroy: true } : {};
  },
};

const brass: MaterialDef = {
  id: 'brass',
  nameKo: '황동',
  nameEn: 'Brass',
  // Type metal that stays in the case: pays while it is NOT played.
  onHeldDuringScoring: (ctx) => {
    ctx.mult *= BALANCE.materials.brass.multFactor;
  },
};

const ivory: MaterialDef = {
  id: 'ivory',
  nameKo: '상아',
  nameEn: 'Ivory',
  onHeldAtBlindEnd: () => ({ goldDelta: BALANCE.materials.ivory.gold }),
};

export const MATERIAL_REGISTRY: ReadonlyMap<TileMaterial, MaterialDef> = new Map(
  [porcelain, polished, stone, leadPlate, glass, brass, ivory].map((m) => [m.id, m]),
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
): { chipsDelta: number; multDelta: number; side: MaterialSideEffects } | null {
  const def = MATERIAL_REGISTRY.get(tile.material);
  if (!def?.onTileScored) return null;
  const beforeChips = ctx.chips;
  const beforeMult = ctx.mult;
  const side = def.onTileScored(ctx, tile, rng) ?? {};
  return { chipsDelta: ctx.chips - beforeChips, multDelta: ctx.mult - beforeMult, side };
}

/**
 * Apply the materials of tiles REMAINING in hand (Brass). Fires once per held
 * tile, per word. Returns one delta record per tile that actually moved the
 * numbers, for the UI settle log.
 */
export function applyHeldMaterials(
  ctx: WordScoringContext,
  held: readonly Tile[],
): { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }[] {
  const out: { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }[] = [];
  for (const tile of held) {
    const def = MATERIAL_REGISTRY.get(tile.material);
    if (!def?.onHeldDuringScoring) continue;
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    def.onHeldDuringScoring(ctx, tile);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      out.push({ material: tile.material, tileId: tile.id, chipsDelta, multDelta });
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
