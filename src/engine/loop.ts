/**
 * Core loop state machine (GDD §6). One blind = shuffle bag → fill hand →
 * [spell → submit → settle → draw back up] × phases → end.
 *
 * All functions are pure: they take a BlindState and return a NEW one, leaving
 * inputs (and the run's permanent bag) untouched. Illegal moves throw.
 *
 * Slice ① scope: startBlind, discardTiles (per-blind budget, §6.3), submitWord
 * (letter-chip settlement + gibberish, §6.4/§7.1). Suit multipliers (②),
 * sentence projection (③), joker hooks (④) and the target curve (⑤) layer on
 * later — projectedScore currently just tracks committedScore.
 */

import { BALANCE } from './balance';
import { drawTiles } from './bag';
import type { Rng } from './rng';
import type { Lexicon } from './lexicon';
import { baseScore, spell, letterString } from './scoring';
import { applyTileMaterial } from './materials';
import { finalizeScore, judgeSentence } from './patterns';
import { evaluateLetterHand } from './letterHands';
import { defaultJokerBus } from './jokers';
import { BOSS_REGISTRY, drawBoss } from './bosses';
import { blindTarget } from './economy';
import { kindForIndex } from './progression';
import type {
  BlindKind,
  BlindState,
  RunState,
  ScoreEvent,
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
  // Only boss blinds carry a bossId; opts.bossId is used only then (so callers can
  // always pass the pre-drawn chapter boss, playtest-04 D-6).
  const bossId = kind === 'boss' ? (opts.bossId ?? drawBoss(rng)) : null;

  let blind: BlindState = {
    kind,
    bossId,
    target: opts.target ?? blindTarget(run.ante, kind),
    phasesTotal: run.basePhases,
    phasesUsed: 0,
    discardsLeft: run.baseDiscards,
    committedScore: 0,
    projectedScore: 0,
    sequence: [],
    bag,
    hand,
    discardedThisBlind: [],
    earlyEndDisabled: false,
    previewHidden: false,
  };

  // Apply the boss's setup effect (phases, discards, flags — GDD §8.3).
  if (bossId) blind = BOSS_REGISTRY.get(bossId)?.setup?.(blind) ?? blind;
  return blind;
}

/**
 * Early-end trigger (GDD §7.2): the end button activates once the projected
 * score reaches the blind target. projectedScore is committed + the sentence
 * bonus projection, re-judged (overwritten) each phase — the bonus half arrives
 * in slice ③, so for now projected mirrors committed.
 */
export function canEndEarly(blind: BlindState): boolean {
  if (blind.earlyEndDisabled) return false; // The Perfectionist (GDD §8.3)
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
 * Discard (GDD §6.3, Balatro-aligned): the chosen tiles LEAVE PLAY for the rest
 * of the blind — they move to `discardedThisBlind` and are NOT returned to the
 * bag mid-blind. Replacements are drawn from the remaining (already-shuffled)
 * bag, so no RNG is needed; if the bag runs dry, fewer are drawn (no refill,
 * §6.6). Budget is PER BLIND (count of discards) with NO per-use tile cap
 * (playtest-04 D-4) — one discard may dump any number of marked tiles. Used tiles
 * (discarded + played) return to the bag only when the blind ends.
 */
export function discardTiles(blind: BlindState, tileIds: readonly string[]): BlindState {
  if (blind.discardsLeft <= 0) {
    throw new Error('discard budget exhausted for this blind');
  }
  const removed = takeFromHand(blind.hand, tileIds); // validates membership

  const removedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !removedIds.has(t.id));
  const { drawn, bag } = drawTiles(blind.bag, removed.length);

  return {
    ...blind,
    hand: [...keptHand, ...drawn],
    bag,
    discardedThisBlind: [...blind.discardedThisBlind, ...removed],
    discardsLeft: blind.discardsLeft - 1,
  };
}

export interface SubmitResult {
  blind: BlindState;
  submission: WordSubmission;
  /** ordered settle steps for the UI to replay (UI_DESIGN §4.1) */
  events: ScoreEvent[];
  /** run-gold change from this submission (The Taxman = −1; Lead plate material = +$20 on its 1/15 roll); 0 normally */
  goldDelta: number;
  /** tiles destroyed by their material (Glass) — the caller removes them from run.bag */
  destroyedTileIds: string[];
}

/**
 * Layer 1 & 2: accumulate chips per tile, apply the suit mult, let jokers mutate
 * (wordScoring), settle chips × mult — recording an ordered ScoreEvent log along
 * the way. Jokers are emitted one at a time so each contribution is a captured
 * delta; the additive/independent nature of wordScoring hooks makes this
 * identical to the batch emit.
 */
function scoreSubmission(
  tiles: readonly Tile[],
  lexicon: Lexicon,
  run: RunState,
  blind: BlindState,
  rng: Rng,
): { submission: WordSubmission; events: ScoreEvent[]; materialGold: number; destroyedTileIds: string[] } {
  const b = baseScore(tiles, lexicon);
  const submission: WordSubmission = {
    tiles: tiles.slice(),
    text: b.text,
    isGibberish: b.isGibberish,
    suit: b.suit,
    posUsed: null,
    settledScore: 0,
  };
  const events: ScoreEvent[] = [];

  const ctx: WordScoringContext = { submission, chips: 0, mult: b.mult };
  let materialGold = 0;
  const destroyedTileIds: string[] = [];
  for (const t of tiles) {
    const chips = t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
    ctx.chips += chips;
    events.push({ kind: 'tile', tileId: t.id, letter: t.letter, chips });

    const mat = applyTileMaterial(ctx, t, rng);
    if (mat) {
      materialGold += mat.side.goldDelta ?? 0;
      if (mat.side.destroy) destroyedTileIds.push(t.id);
      if (mat.chipsDelta !== 0 || mat.multDelta !== 0) {
        events.push({
          kind: 'material',
          material: t.material,
          tileId: t.id,
          chipsDelta: mat.chipsDelta,
          multDelta: mat.multDelta,
        });
      }
    }
  }
  events.push({ kind: 'suit', suit: b.suit, mult: b.mult });

  // Letter hand (A-2): highest single per-word structure bonus, folded in before
  // the suit multiplier settles. Vowel Flush / Straight also fire on gibberish.
  const letters = letterString(tiles);
  const letterHand = evaluateLetterHand(letters, submission.isGibberish);
  if (letterHand && (letterHand.chips !== 0 || letterHand.mult !== 0)) {
    ctx.chips += letterHand.chips;
    ctx.mult += letterHand.mult;
    events.push({
      kind: 'letterHand',
      hand: letterHand.id,
      chipsDelta: letterHand.chips,
      multDelta: letterHand.mult,
    });
  }

  for (const joker of run.jokers) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    defaultJokerBus.emit('wordScoring', { run, blind, ctx }, [joker]);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      events.push({ kind: 'joker', jokerId: joker.defId, chipsDelta, multDelta });
    }
  }

  // Boss word-scoring effects run after jokers (GDD §8.3).
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  if (boss?.wordScoring) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    boss.wordScoring(ctx);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      events.push({ kind: 'boss', bossId: blind.bossId!, chipsDelta, multDelta });
    }
  }

  let total = ctx.chips * ctx.mult;
  if (boss?.voids?.(submission, blind.sequence)) total = 0; // The Purist
  submission.settledScore = total;
  events.push({ kind: 'settle', chips: ctx.chips, mult: ctx.mult, total });
  return { submission, events, materialGold, destroyedTileIds };
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
  // Boss sentence effects run after jokers (The Anarchist voids the bonus).
  if (blind.bossId) BOSS_REGISTRY.get(blind.bossId)?.sentenceScoring?.(ctx);
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
  rng: Rng,
): SubmitResult {
  if (blind.phasesUsed >= blind.phasesTotal) {
    throw new Error('no phases remain in this blind');
  }
  const used = takeFromHand(blind.hand, tileIds); // validates membership, keeps order

  // Boss legality (The Noun Lock blocks verbs) + economy drain (The Taxman).
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  if (boss?.blocks?.(spell(used), lexicon)) {
    throw new Error('boss: this word cannot be submitted');
  }

  const { submission, events, materialGold, destroyedTileIds } = scoreSubmission(
    used,
    lexicon,
    run,
    blind,
    rng,
  );
  const goldDelta = (boss?.goldPerWord ? -boss.goldPerWord : 0) + materialGold;

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

  return { submission, events, goldDelta, destroyedTileIds, blind: { ...afterBlind, projectedScore } };
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
