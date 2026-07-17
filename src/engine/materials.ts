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

export const MATERIAL_REGISTRY: ReadonlyMap<TileMaterial, MaterialDef> = new Map(
  [porcelain, polished, stone].map((m) => [m.id, m]),
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
