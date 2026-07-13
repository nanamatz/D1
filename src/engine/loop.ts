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
import { baseScore } from './scoring';
import { finalizeScore, judgeSentence } from './patterns';
import { defaultJokerBus } from './jokers';
import { blindTarget } from './economy';
import { kindForIndex } from './progression';
import type {
  BlindKind,
  BlindState,
  RunState,
  SentenceJudgment,
  SentenceScoringContext,
  Tile,
  WordScoringContext,
  WordSubmission,
} from './types';

export interface StartBlindOptions {
  kind?: BlindKind;
  bossId?: string | null;
  /** blind target; defaults to the ante-curve value for the run's position (§8.2) */
  target?: number;
}

/** Set up a blind: shuffle a copy of the run bag, deal the opening hand (§6.1).
 *  Kind and target default to the run's position on the ante curve (GDD §8.2). */
export function startBlind(run: RunState, rng: Rng, opts: StartBlindOptions = {}): BlindState {
  const shuffled = rng.shuffle(run.bag);
  const { drawn: hand, bag } = drawTiles(shuffled, run.handSize);
  const kind = opts.kind ?? kindForIndex(run.blindIndex);
  return {
    kind,
    bossId: opts.bossId ?? null,
    target: opts.target ?? blindTarget(run.ante, kind),
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

/**
 * Early-end trigger (GDD §7.2): the end button activates once the projected
 * score reaches the blind target. projectedScore is committed + the sentence
 * bonus projection, re-judged (overwritten) each phase — the bonus half arrives
 * in slice ③, so for now projected mirrors committed.
 */
export function canEndEarly(blind: BlindState): boolean {
  return blind.projectedScore >= blind.target;
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

/** Layer 1 & 2: base chips/mult → jokers mutate (wordScoring) → settle chips × mult. */
function scoreSubmission(
  tiles: readonly Tile[],
  lexicon: Lexicon,
  run: RunState,
  blind: BlindState,
): WordSubmission {
  const b = baseScore(tiles, lexicon);
  const submission: WordSubmission = {
    tiles: tiles.slice(),
    text: b.text,
    isGibberish: b.isGibberish,
    suit: b.suit,
    posUsed: null,
    settledScore: 0,
  };
  const ctx: WordScoringContext = { submission, chips: b.chips, mult: b.mult };
  defaultJokerBus.emit('wordScoring', { run, blind, ctx }, run.jokers);
  submission.settledScore = ctx.chips * ctx.mult;
  return submission;
}

/** Layer 3: fold the pattern/unison bonus → jokers mutate (sentenceScoring) → total. */
function scoreSentence(
  committed: number,
  sequence: readonly WordSubmission[],
  judgment: SentenceJudgment,
  run: RunState,
  blind: BlindState,
): number {
  const base = finalizeScore(committed, judgment, run.patternLevels);
  const ctx: SentenceScoringContext = {
    sequence: sequence.slice(),
    match: judgment.match,
    unison: judgment.unison,
    totalBefore: committed,
    flatBonus: base.flatBonus,
    totalMultiplier: base.totalMultiplier,
  };
  defaultJokerBus.emit('sentenceScoring', { run, blind, ctx }, run.jokers);
  return (ctx.totalBefore + ctx.flatBonus) * ctx.totalMultiplier;
}

/**
 * Submit a word (one phase, §6.1): score it (layer 1, settled immediately §7.1),
 * append to the sentence sequence, then draw back up by the number of tiles used
 * (no refill if the bag is dry, §6.6).
 */
export function submitWord(
  blind: BlindState,
  run: RunState,
  lexicon: Lexicon,
  tileIds: readonly string[],
): SubmitResult {
  if (blind.phasesUsed >= blind.phasesTotal) {
    throw new Error('no phases remain in this blind');
  }
  const used = takeFromHand(blind.hand, tileIds); // validates membership, keeps order
  const submission = scoreSubmission(used, lexicon, run, blind);

  const usedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !usedIds.has(t.id));
  const { drawn, bag } = drawTiles(blind.bag, used.length);

  const committedScore = blind.committedScore + submission.settledScore;
  const sequence = [...blind.sequence, submission];

  // Build the post-phase blind first so layer-3 jokers (e.g. Rush Specialist)
  // read the correct phases-remaining when projecting.
  const afterBlind: BlindState = {
    ...blind,
    hand: [...keptHand, ...drawn],
    bag,
    // used tiles are spent for the blind; they return to the bag at blind end (§6.1)
    discardedThisBlind: [...blind.discardedThisBlind, ...used],
    sequence,
    committedScore,
    projectedScore: 0,
    phasesUsed: blind.phasesUsed + 1,
  };

  // Re-judge the WHOLE sequence and overwrite the projection (GDD §7.1) — the
  // sentence bonus is a projection, never accumulated per phase.
  const judgment = judgeSentence(sequence, lexicon);
  const projectedScore = scoreSentence(committedScore, sequence, judgment, run, afterBlind);

  return { submission, blind: { ...afterBlind, projectedScore } };
}

export interface EndBlindResult {
  judgment: SentenceJudgment;
  /** the settled blind score after finalizing the sentence bonus (GDD §7.4) */
  finalScore: number;
  /** unused phases → gold on ending (economy lands in slice ⑤) */
  phasesLeft: number;
}

/**
 * Finalize the blind (GDD §7.4): judge the final sequence and fold the sentence
 * bonus into the committed total. Tiles need no explicit return — each blind
 * reshuffles the run's permanent bag from scratch, so used tiles are back next
 * blind automatically (§6.1, §6.6).
 */
export function endBlind(blind: BlindState, run: RunState, lexicon: Lexicon): EndBlindResult {
  const judgment = judgeSentence(blind.sequence, lexicon);
  const finalScore = scoreSentence(blind.committedScore, blind.sequence, judgment, run, blind);
  return { judgment, finalScore, phasesLeft: blind.phasesTotal - blind.phasesUsed };
}
