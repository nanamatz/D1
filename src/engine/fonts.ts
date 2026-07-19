/**
 * Font seal effects (GDD §2.3) — the edition layer, as data.
 *
 * Mirrors materials.ts: a font never hard-codes itself into pipeline code.
 * The play-trigger effects (goldPlay/chipPlay/retriggerPlay) fire inside the
 * per-tile scoring block in loop.ts (so retriggerPlay repeats the whole
 * block); discardGain fires in discardTiles. The font↔effect mapping lives in
 * BALANCE.fontEffects (PROVISIONAL until design supplies the final mapping).
 */

import { BALANCE } from './balance';
import { CONSUMABLE_POOL } from './packs';
import type { Rng } from './rng';
import type { ConsumableId, FontEffectId, RunState, Tile, TileFont } from './types';

/** The effect this font carries, or null for the base font (medium). */
export function fontEffectOf(font: TileFont): FontEffectId | null {
  if (font === 'medium') return null;
  return BALANCE.fontEffects[font];
}

export interface DiscardGainResult {
  /** consumables gained (already slot-checked against run capacity) */
  gained: ConsumableId[];
  /** discardGain triggers that no-opped because slots were full (→ UI toast) */
  slotsBlocked: number;
}

/**
 * Roll discardGain for a batch of discarded tiles (GDD §2.3 Purple-Seal port):
 * one random consumable per triggering tile, but only while the run has free
 * consumable slots — beyond capacity the trigger does nothing. Pure: the
 * caller appends `gained` to run.consumables.
 */
export function rollDiscardGains(
  run: RunState,
  discarded: readonly Tile[],
  rng: Rng,
): DiscardGainResult {
  const free = run.consumableSlots - run.consumables.length;
  const gained: ConsumableId[] = [];
  let slotsBlocked = 0;
  for (const t of discarded) {
    if (fontEffectOf(t.font) !== 'discardGain') continue;
    if (gained.length >= free) {
      slotsBlocked++;
      continue;
    }
    gained.push(CONSUMABLE_POOL[rng.int(CONSUMABLE_POOL.length)]!);
  }
  return { gained, slotsBlocked };
}
