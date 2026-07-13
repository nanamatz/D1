/**
 * The bag — the permanent, sculptable 98-tile asset (GDD §2.1, §6.1).
 *
 * buildBag creates the starting bag from BALANCE.bagComposition. Tiles are
 * plain data with stable ids; enhancement (material) and edition (font) start
 * at their unenhanced bases (ceramic / medium, GDD §2.2–2.3).
 *
 * Shuffling is the RNG's job (rng.shuffle). Drawing takes tiles off the top and
 * never refills mid-blind (GDD §6.6) — drawing more than remain yields only
 * what is left.
 */

import { BALANCE } from './balance';
import type { Letter, Tile } from './types';

/** Build the starting bag (98 tiles) from the composition table. */
export function buildBag(): Tile[] {
  const bag: Tile[] = [];
  let n = 0;
  for (const [letter, count] of Object.entries(BALANCE.bagComposition)) {
    for (let i = 0; i < count; i++) {
      bag.push({
        id: `t${n++}-${letter}`,
        letter: letter as Letter,
        case: 'upper',
        material: 'ceramic',
        font: 'medium',
      });
    }
  }
  return bag;
}

export interface DrawResult {
  drawn: Tile[];
  /** the bag with the drawn tiles removed (a new array; source is untouched) */
  bag: Tile[];
}

/**
 * Draw `n` tiles off the top of the bag. If fewer remain, draw only those
 * (no refill, GDD §6.6). The source array is not mutated.
 */
export function drawTiles(bag: readonly Tile[], n: number): DrawResult {
  const take = Math.min(n, bag.length);
  return {
    drawn: bag.slice(0, take),
    bag: bag.slice(take),
  };
}
