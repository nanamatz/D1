/**
 * Joker registry (GDD §11). One joker per file, grouped by rarity here.
 * The proof set for slice ④ spans all three layers and every hook type:
 *   layer 1 (wordScoring, fires on gibberish): #1, #2, #10
 *   layer 2 (wordScoring, suit-gated):          #12
 *   layer 3 (sentenceScoring):                  #22, #24
 */

import { JokerBus, type JokerDef } from '../events';
import { vowelPraise } from './vowelPraise';
import { consonantBricklayer } from './consonantBricklayer';
import { jackOfAllTrades } from './jackOfAllTrades';
import { hipster } from './hipster';
import { grammarian } from './grammarian';
import { rushSpecialist } from './rushSpecialist';

export const COMMON_JOKERS: readonly JokerDef[] = [vowelPraise, consonantBricklayer, jackOfAllTrades];
export const UNCOMMON_JOKERS: readonly JokerDef[] = [hipster];
export const RARE_JOKERS: readonly JokerDef[] = [grammarian, rushSpecialist];

export const ALL_JOKERS: readonly JokerDef[] = [
  ...COMMON_JOKERS,
  ...UNCOMMON_JOKERS,
  ...RARE_JOKERS,
];

export const JOKER_REGISTRY: ReadonlyMap<string, JokerDef> = new Map(
  ALL_JOKERS.map((j) => [j.id, j]),
);

/** The engine-wide bus over the full registry. Emits are no-ops when a run owns no jokers. */
export const defaultJokerBus = new JokerBus(JOKER_REGISTRY);
