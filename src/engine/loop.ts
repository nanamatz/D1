/**
 * Core loop state machine (GDD §6). One blind = shuffle bag → fill hand →
 * [spell → submit → settle → draw back up] × phases → end.
 *
 * All functions are pure: they take a BlindState and return a NEW one, leaving
 * inputs (and the run's permanent bag) untouched. Illegal moves throw.
 *
 * Slice ① scope: startBlind, exchangeTiles (per-blind budget, §6.3), submitWord
 * (letter-chip settlement + gibberish, §6.4/§7.1). Suit multipliers (②),
 * sentence projection (③), joker hooks (④) and the target curve (⑤) layer on
 * later — projectedScore currently just tracks committedScore.
 */

import { BALANCE } from './balance';
import { drawTiles } from './bag';
import type { Rng } from './rng';
import type { Lexicon } from './lexicon';
import { scoreWord } from './scoring';
import type { BlindKind, BlindState, RunState, Tile, WordSubmission } from './types';

export interface StartBlindOptions {
  kind?: BlindKind;
  bossId?: string | null;
  /** blind target; the real ante/blind curve is slice ⑤, so this defaults to 0 */
  target?: number;
}

/** Set up a blind: shuffle a copy of the run bag, deal the opening hand (§6.1). */
export function startBlind(run: RunState, rng: Rng, opts: StartBlindOptions = {}): BlindState {
  const shuffled = rng.shuffle(run.bag);
  const { drawn: hand, bag } = drawTiles(shuffled, run.handSize);
  return {
    kind: opts.kind ?? 'small',
    bossId: opts.bossId ?? null,
    target: opts.target ?? 0,
    phasesTotal: run.basePhases,
    phasesUsed: 0,
    exchangesLeft: run.baseExchanges,
    exchangeSize: BALANCE.tilesPerExchange,
    committedScore: 0,
    projectedScore: 0,
    sequence: [],
    bag,
    hand,
    discardedThisBlind: [],
  };
}

/** Pick tiles from hand by id, preserving the given order; throws on any miss. */
function takeFromHand(hand: readonly Tile[], ids: readonly string[]): Tile[] {
  const byId = new Map(hand.map((t) => [t.id, t]));
  const picked: Tile[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (!t) throw new Error(`tile ${id} is not in hand`);
    picked.push(t);
  }
  return picked;
}

/**
 * Exchange (the discard equivalent, §6.3): return the chosen tiles to the bag,
 * reshuffle, and draw the same number back. Budget is PER BLIND.
 */
export function exchangeTiles(blind: BlindState, tileIds: readonly string[], rng: Rng): BlindState {
  if (blind.exchangesLeft <= 0) {
    throw new Error('exchange budget exhausted for this blind');
  }
  if (tileIds.length > blind.exchangeSize) {
    throw new Error(`cannot exchange more than ${blind.exchangeSize} tiles at once`);
  }
  const returned = takeFromHand(blind.hand, tileIds); // validates membership

  const returnedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !returnedIds.has(t.id));
  const reshuffled = rng.shuffle([...blind.bag, ...returned]);
  const { drawn, bag } = drawTiles(reshuffled, returned.length);

  return {
    ...blind,
    hand: [...keptHand, ...drawn],
    bag,
    exchangesLeft: blind.exchangesLeft - 1,
  };
}

export interface SubmitResult {
  blind: BlindState;
  submission: WordSubmission;
}

/**
 * Submit a word (one phase, §6.1): score it (layer 1, settled immediately §7.1),
 * append to the sentence sequence, then draw back up by the number of tiles used
 * (no refill if the bag is dry, §6.6).
 */
export function submitWord(
  blind: BlindState,
  _run: RunState,
  lexicon: Lexicon,
  tileIds: readonly string[],
): SubmitResult {
  if (blind.phasesUsed >= blind.phasesTotal) {
    throw new Error('no phases remain in this blind');
  }
  const used = takeFromHand(blind.hand, tileIds); // validates membership, keeps order
  const submission = scoreWord(used, lexicon);

  const usedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !usedIds.has(t.id));
  const { drawn, bag } = drawTiles(blind.bag, used.length);

  const committedScore = blind.committedScore + submission.settledScore;

  return {
    submission,
    blind: {
      ...blind,
      hand: [...keptHand, ...drawn],
      bag,
      // used tiles are spent for the blind; they return to the bag at blind end (§6.1)
      discardedThisBlind: [...blind.discardedThisBlind, ...used],
      sequence: [...blind.sequence, submission],
      committedScore,
      // no sentence bonus yet (slices ②–③); projected == committed for now
      projectedScore: committedScore,
      phasesUsed: blind.phasesUsed + 1,
    },
  };
}
