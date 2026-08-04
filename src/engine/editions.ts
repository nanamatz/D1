import { BALANCE } from './balance';
import { editionRateMultiplier } from './vouchers';
import type { Rng } from './rng';
import type { JokerEdition, RunState, TileEdition, WordScoringContext } from './types';

const TILE_EDITIONS: readonly TileEdition[] = ['gray', 'violet', 'rainbow'];
const JOKER_EDITIONS: readonly JokerEdition[] = ['gray', 'violet', 'rainbow', 'white'];

function rateTier(run: RunState): 'base' | 'flyer' | 'wantedPoster' {
  const multiplier = editionRateMultiplier(run);
  return multiplier === 4 ? 'wantedPoster' : multiplier === 2 ? 'flyer' : 'base';
}

function rollEdition<T extends string>(
  rng: Pick<Rng, 'next'>,
  rates: Readonly<Partial<Record<T, number>>>,
  editions: readonly T[],
): T | 'base' {
  let roll = rng.next();
  for (const edition of editions) {
    roll -= rates[edition] ?? 0;
    if (roll < 0) return edition;
  }
  return 'base';
}

/** Seeded edition roll. Flyer/Wanted Poster select higher non-White rate tables. */
export function rollTileEdition(run: RunState, rng: Pick<Rng, 'next'>): TileEdition {
  return rollEdition(rng, BALANCE.editionRates.tile[rateTier(run)], TILE_EDITIONS);
}

export function rollJokerEdition(run: RunState, rng: Pick<Rng, 'next'>): JokerEdition {
  return rollEdition(rng, BALANCE.editionRates.joker[rateTier(run)], JOKER_EDITIONS);
}

/** Encyclopedia shop tiles use a fixed 20% edition table, unaffected by Flyer. */
export function rollShopTileEdition(rng: Pick<Rng, 'next'>): TileEdition {
  return rollEdition(rng, BALANCE.editionRates.shopTile, TILE_EDITIONS);
}

export interface EditionDelta {
  chipsDelta: number;
  multDelta: number;
  multFactor?: number;
}

export function applyEdition(
  ctx: WordScoringContext,
  edition: TileEdition | JokerEdition,
): EditionDelta | null {
  if (edition === 'gray') {
    ctx.chips += BALANCE.edition.grayChips;
    return { chipsDelta: BALANCE.edition.grayChips, multDelta: 0 };
  }
  if (edition === 'violet') {
    ctx.mult += BALANCE.edition.violetMult;
    return { chipsDelta: 0, multDelta: BALANCE.edition.violetMult };
  }
  if (edition === 'rainbow') {
    const before = ctx.mult;
    ctx.mult *= BALANCE.edition.rainbowFactor;
    return {
      chipsDelta: 0,
      multDelta: ctx.mult - before,
      multFactor: BALANCE.edition.rainbowFactor,
    };
  }
  return null;
}
