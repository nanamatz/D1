/**
 * The Gambler id space (GDD §10.3), as a LEAF module: it imports nothing at
 * runtime, so importing it can never pull the rest of the engine in behind it.
 *
 * Why this is separate from `gamblers.ts` rather than living with the defs:
 * `gamblers.ts` reaches the Emoji Tile rarity rosters (Crane and Sun, Phoenix),
 * which drags in `jokers/index` and every joker's hooks. `pouches.ts` needs only
 * the id list — the Lucky pouch starts with one random Gambler card — and that
 * one import closed two cycles:
 *
 *   economy -> pouches -> gamblers -> jokers/index -> interestGlutton -> economy
 *   fables  -> economy -> pouches  -> gamblers -> fables
 *
 * which made `jokers/index`, `loop`, `shop` and `packs` throw
 * `ReferenceError: Cannot access 'RARE_JOKERS' before initialization` whenever
 * one of them was the first module loaded. Splitting the ids out is the smallest
 * cut that removes both cycles; `scripts/check-engine-cycles.mjs` keeps them gone.
 *
 * Every id here is implemented and may roll through the shared acquisition paths.
 */
import type { ConsumableId } from './types';

export type GamblerId =
  | 'barnSwallow' | 'boar' | 'bridge' | 'bushWarbler' | 'butterflies'
  | 'craneAndSun' | 'cuckoo' | 'curtain' | 'deer' | 'fullMoon'
  | 'geese' | 'phoenix' | 'rainman' | 'sakeCup';

export const GAMBLER_IDS: readonly GamblerId[] = [
  'barnSwallow', 'boar', 'bridge', 'bushWarbler', 'butterflies',
  'craneAndSun', 'cuckoo', 'curtain', 'deer', 'fullMoon',
  'geese', 'phoenix', 'rainman', 'sakeCup',
];

/** Cards eligible for ordinary acquisition; Deer and Phoenix are Ink jackpots. */
export const ORDINARY_GAMBLER_IDS: readonly GamblerId[] = GAMBLER_IDS.filter(
  (id) => id !== 'deer' && id !== 'phoenix',
);

export const isGamblerId = (id: ConsumableId): id is GamblerId =>
  (GAMBLER_IDS as readonly ConsumableId[]).includes(id);
