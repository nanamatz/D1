import { BALANCE } from './balance';
import { editionRateMultiplier } from './vouchers';
import type { Rng } from './rng';
import type { JokerEdition, RunState, TileEdition, WordScoringContext } from './types';

const SPECIAL: readonly TileEdition[] = ['foil', 'holographic', 'polychrome'];

/** Seeded edition roll. Flyer/Wanted Poster multiply only Foil/Holo/Poly odds. */
export function rollTileEdition(run: RunState, rng: Pick<Rng, 'next' | 'int'>): TileEdition {
  const chance = Math.min(1, BALANCE.voucher.editionChance * editionRateMultiplier(run));
  return rng.next() < chance ? SPECIAL[rng.int(SPECIAL.length)]! : 'base';
}

export function rollJokerEdition(run: RunState, rng: Pick<Rng, 'next' | 'int'>): JokerEdition {
  const chance = Math.min(1, BALANCE.voucher.editionChance * editionRateMultiplier(run));
  if (rng.next() >= chance) return 'base';
  return SPECIAL[rng.int(SPECIAL.length)]!;
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
  if (edition === 'foil') {
    ctx.chips += BALANCE.edition.foilChips;
    return { chipsDelta: BALANCE.edition.foilChips, multDelta: 0 };
  }
  if (edition === 'holographic') {
    ctx.mult += BALANCE.edition.holographicMult;
    return { chipsDelta: 0, multDelta: BALANCE.edition.holographicMult };
  }
  if (edition === 'polychrome') {
    const before = ctx.mult;
    ctx.mult *= BALANCE.edition.polychromeFactor;
    return {
      chipsDelta: 0,
      multDelta: ctx.mult - before,
      multFactor: BALANCE.edition.polychromeFactor,
    };
  }
  return null;
}
