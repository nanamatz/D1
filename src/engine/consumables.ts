/**
 * The consumable id space, in one place (GDD §10).
 *
 * Three card families plus the loose stationery items make up `ConsumableId`.
 * This module owns the union of every id the engine can actually resolve, so a
 * save holding a retired id can be filtered on load instead of booting a run
 * that references a card nothing implements.
 */
import { CONSTELLATION_IDS } from './constellations';
import { FABLE_IDS } from './fables';
import { GAMBLER_IDS } from './gamblers';
import type { ConsumableId } from './types';

/** Stationery items that are not part of a card family. */
export const STATIONERY_IDS: readonly ConsumableId[] = ['magnifier'];

export const ALL_CONSUMABLE_IDS: readonly ConsumableId[] = [
  ...STATIONERY_IDS,
  ...FABLE_IDS,
  ...CONSTELLATION_IDS,
  ...GAMBLER_IDS,
];

const KNOWN = new Set<string>(ALL_CONSUMABLE_IDS);

/**
 * True when the engine can resolve this id. Retiring a card means deleting it
 * from `ConsumableId` and from its family list — resting saves that still hold
 * it are cleaned up by this check rather than by a save-version bump.
 */
export const isKnownConsumableId = (id: string): id is ConsumableId => KNOWN.has(id);
