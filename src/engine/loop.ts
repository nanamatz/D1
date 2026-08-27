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
import { baseScore, letterString, submissionLetterString, tileBaseChips, wordLengthMult, type BaseScore } from './scoring';
import { applyTileMaterial, applyHeldMaterials, collectBlindEndMaterials } from './materials';
import { applyEdition } from './editions';
import { finalizeScore, judgeSentence, sentenceTotal } from './patterns';
import { evaluateLetterHand } from './letterHands';
import { fontEffectOf, rollDiscardGains } from './fonts';
import { defaultJokerBus, JOKER_REGISTRY, recordLifecycleGrowth } from './jokers';
import {
  afterBossPlay,
  BOSS_REGISTRY,
  bossAllowsDiscard,
  bossPoolForAnte,
  drawBoss,
  sentenceSequenceForBlind,
} from './bosses';
import { effectiveBlindTarget } from './economy';
import { kindForIndex } from './progression';
import { constellationPassiveFactor } from './vouchers';
import { balancePouchAxes } from './pouches';
import { EMPTY_NEXT_BLIND_BONUS, tagDebuffsSubmission } from './skipRewards';
import type {
  BlindSelectedJokerTrigger,
  DestroyedJokerSnapshot,
  JokerGrowthTrigger,
  JokerScoreBeat,
} from './events';
import { pruneEchoNamespaces } from './events';
import type {
  BlindKind,
  BlindState,
  ConsumableId,
  Letter,
  LetterHandId,
  RunState,
  ScoreEvent,
  SentenceBonusBreakdown,
  SentenceJudgment,
  SentenceScoringContext,
  Tile,
  WordScoringContext,
  WordSubmission,
} from './types';
import { VOWELS } from './types';

export interface StartBlindOptions {
  kind?: BlindKind;
  bossId?: string | null;
  /** blind target; defaults to the ante-curve value for the run's position (§8.2) */
  target?: number;
  /** Deal these letters at the FRONT of the opening hand, in order, then fill randomly.
   *  UI-only hook for the scripted first-run lesson (rig YELLOW). A letter not present in
   *  the bag is skipped. The engine stays generic — it just front-loads the draw. */
  openingLetters?: readonly Letter[];
}

/** Move the first tile of each requested letter to the front of the (shuffled) bag, in the
 *  given order; letters not found are skipped. Used only via StartBlindOptions.openingLetters. */
function frontLoadLetters(bag: readonly Tile[], letters: readonly Letter[]): Tile[] {
  const rest = [...bag];
  const front: Tile[] = [];
  for (const L of letters) {
    const i = rest.findIndex((t) => t.letter === L);
    if (i >= 0) front.push(rest.splice(i, 1)[0]!);
  }
  return [...front, ...rest];
}

/** Set up a blind: shuffle a copy of the run bag, deal the opening hand (§6.1).
 *  Kind and target default to the run's position on the ante curve (GDD §8.2). */
export function startBlind(run: RunState, rng: Rng, opts: StartBlindOptions = {}): BlindState {
  const kind = opts.kind ?? kindForIndex(run.blindIndex);
  // Only boss blinds carry a bossId; opts.bossId is used only then (so callers can
  // always pass the pre-drawn chapter boss, playtest-04 D-6). Resolve the boss BEFORE
  // the shuffle so its hand-size delta can shrink the opening draw (Budget Book, §8.3);
  // drawBoss (the no-explicit-id path) consumes rng, so ordering matters only there.
  const bossId =
    kind === 'boss' ? (opts.bossId ?? drawBoss(rng, bossPoolForAnte(run.ante))) : null;
  const boss = bossId ? BOSS_REGISTRY.get(bossId) : undefined;

  const nextBonus = kind === kindForIndex(run.blindIndex)
    ? run.nextBlindBonus
    : EMPTY_NEXT_BLIND_BONUS;
  const effHandSize = Math.max(
    1,
    run.handSize + (boss?.handSizeDelta ?? 0) + nextBonus.handSize,
  );
  const shuffled = rng.shuffle(run.bag);
  const ordered = opts.openingLetters ? frontLoadLetters(shuffled, opts.openingLetters) : shuffled;
  const targetMult = boss?.targetMult ?? 1; // Wanted ×2

  let blind: BlindState = {
    kind,
    bossId,
    target:
      opts.target !== undefined
        ? opts.target * targetMult * nextBonus.targetMultiplier
        : effectiveBlindTarget(run, kind, targetMult),
    handSizeTotal: effHandSize,
    phasesTotal: Math.max(1, run.basePhases + nextBonus.phases),
    phasesUsed: 0,
    discardsLeft: Math.max(0, run.baseDiscards + nextBonus.discards),
    committedScore: nextBonus.startingScore,
    projectedScore: nextBonus.startingScore,
    sequence: [],
    bag: ordered,
    hand: [],
    discardedThisBlind: [],
    earlyEndDisabled: false,
    previewHidden: false,
    vowelsHidden: false,
    forcedTileId: null,
    jokersFaceDown: false,
    deadLetter: null,
    lipogramLetters: [...(nextBonus.lipogramLetters ?? [])],
    scarletLetters: [...(nextBonus.scarletLetters ?? [])],
    clearRewardBonus: nextBonus.clearRewardBonus ?? 0,
  };

  // Apply the boss's setup effect (phases, discards, flags — GDD §8.3).
  if (boss?.setup) blind = boss.setup(blind);
  defaultJokerBus.emit(
    'blindStart',
    { run, blind },
    run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  );
  blind.handSizeTotal = Math.max(1, blind.handSizeTotal);
  blind.discardsLeft = Math.max(0, blind.discardsLeft);
  const opening = drawTiles(blind.bag, blind.handSizeTotal);
  return { ...blind, hand: opening.drawn, bag: opening.bag };
}

/** Resolve permanent Emoji Tile effects when the player confirms Blind Select. */
export function enterJokerBlind(
  run: RunState,
  blind: BlindState,
  rng: Rng,
): {
  run: RunState;
  blind: BlindState;
  createdTiles: Tile[];
  triggers: BlindSelectedJokerTrigger[];
} {
  const nextRun: RunState = {
    ...run,
    bag: run.bag.slice(),
    jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  const nextBlind: BlindState = {
    ...blind,
    hand: blind.hand.slice(),
    bag: blind.bag.slice(),
    discardedThisBlind: blind.discardedThisBlind.slice(),
  };
  const createdTiles: Tile[] = [];
  const triggers: BlindSelectedJokerTrigger[] = [];
  const growthTriggers = defaultJokerBus.emit(
    'blindSelected',
    { run: nextRun, blind: nextBlind, rng, createdTiles, triggers },
    nextRun.jokers,
  );
  if (createdTiles.length > 0) {
    for (const _tile of createdTiles) {
      growthTriggers.push(...defaultJokerBus.emit(
        'tilesCreated', { run: nextRun, count: 1 }, nextRun.jokers,
      ));
    }
  }
  const jokers = nextRun.jokers.filter((joker) => joker.state.destroyed !== 1);
  const recordedRun = recordLifecycleGrowth(
    pruneEchoNamespaces({ ...nextRun, jokers }), growthTriggers,
  );
  return {
    run: recordedRun,
    blind: nextBlind,
    createdTiles,
    triggers: triggers.flatMap((trigger) => {
      const jokerIndex = jokers.indexOf(trigger.joker);
      return jokerIndex < 0 ? [] : [{ ...trigger, jokerIndex }];
    }),
  };
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

/**
 * No tiles in hand and none left to draw: the board cannot be played further, so
 * the blind must resolve (GDD §6.3 — discarded tiles exit play for the blind;
 * §6.6 — the pouch never refills mid-blind). Both conditions are required: a boss
 * `handSizeDelta` can empty the hand for a moment while the pouch still holds tiles.
 */
export function blindExhausted(blind: BlindState): boolean {
  return blind.hand.length === 0 && blind.bag.length === 0;
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

export interface DiscardResult {
  /** Complete post-discard run snapshot, including ordered lifecycle triggers. */
  run: RunState;
  blind: BlindState;
  /** cloned, state-updated owned Emoji Tiles */
  jokers: RunState['jokers'];
  /** gold awarded by discard hooks */
  goldDelta: number;
  /** consumables gained from discardGain-font tiles (already slot-checked);
   *  the CALLER appends them to run.consumables (same division as goldDelta) */
  gained: ConsumableId[];
  /** discardGain triggers that no-opped on full slots (→ UI "slots full" toast) */
  slotsBlocked: number;
  /** Distinct physical letters discarded across this run. */
  discardedLetters: Letter[];
  discardedLetterCounts: Partial<Record<Letter, number>>;
  /** Permanent pouch after discard-triggered destruction. */
  bag: Tile[];
  /** Physical tiles permanently destroyed by discard hooks. */
  destroyedTiles: Tile[];
}

const withDiscardedLetters = (
  run: RunState,
  tiles: readonly Tile[],
): Pick<RunState, 'discardedLetters' | 'discardedLetterCounts'> => {
  const letters = new Set(run.discardedLetters ?? []);
  const counts = { ...(run.discardedLetterCounts ?? {}) };
  for (const tile of tiles) {
    if (!tile.letter) continue;
    letters.add(tile.letter);
    counts[tile.letter] = (counts[tile.letter] ?? 0) + 1;
  }
  return { discardedLetters: [...letters], discardedLetterCounts: counts };
};

/**
 * Discard (GDD §6.3, Balatro-aligned): the chosen tiles LEAVE PLAY for the rest
 * of the blind — they move to `discardedThisBlind` and are NOT returned to the
 * bag mid-blind. Replacements are drawn from the remaining (already-shuffled)
 * bag; the rng is used ONLY for discardGain font rolls (GDD §2.3), never for
 * drawing. Budget is PER BLIND with NO per-use tile cap (playtest-04 D-4).
 */
/** The blind's target hand size — the run's hand size adjusted by the boss (e.g. Budget
 *  Book −3, §8.3). Draw-backs fill the hand UP TO this, so it never sits below full while
 *  the bag has tiles (feedback #9: draw by empty slots, not by the count removed). */
function effectiveHandSize(run: RunState, blind: BlindState): number {
  if (Number.isFinite(blind.handSizeTotal) && blind.handSizeTotal > 0) {
    return blind.handSizeTotal;
  }
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  return Math.max(1, run.handSize + (boss?.handSizeDelta ?? 0));
}

export function discardTiles(
  blind: BlindState,
  run: RunState,
  tileIds: readonly string[],
  rng: Rng,
): DiscardResult {
  if (blind.discardsLeft <= 0) {
    throw new Error('discard budget exhausted for this blind');
  }
  if (blind.forcedTileId && tileIds.includes(blind.forcedTileId)) {
    throw new Error('boss: forced tile cannot be discarded');
  }
  const removed = takeFromHand(blind.hand, tileIds); // validates membership
  if (removed.some((tile) => !bossAllowsDiscard(blind, tile))) {
    throw new Error('boss: this tile cannot be discarded');
  }

  const removedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !removedIds.has(t.id));
  // Draw to REFILL empty slots (feedback #9), not merely the number discarded — so a
  // hand short of full (e.g. a Glass shatter or a tile-removing consumable left a gap)
  // comes back to full. Equivalent to the old draw-per-removed when the hand was full.
  const need = Math.max(0, effectiveHandSize(run, blind) - keptHand.length);
  const { drawn, bag } = drawTiles(blind.bag, need);
  const { gained, slotsBlocked } = rollDiscardGains(run, removed, rng);
  const scoringRun: RunState = {
    ...run,
    ...withDiscardedLetters(run, removed),
    jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  const nextBlind: BlindState = {
    ...blind,
    hand: [...keptHand, ...drawn],
    bag,
    discardedThisBlind: [...blind.discardedThisBlind, ...removed],
    discardsLeft: blind.discardsLeft - 1,
  };
  const goldBefore = scoringRun.gold;
  const destroyedTiles: Tile[] = [];
  const growthTriggers: JokerGrowthTrigger[] = [];
  for (const tile of removed) {
    growthTriggers.push(...defaultJokerBus.emit(
      'tilesDiscarded',
      { run: scoringRun, blind: nextBlind, tiles: [tile] },
      scoringRun.jokers,
    ));
  }
  growthTriggers.push(...defaultJokerBus.emit(
    'discardUsed',
    {
      run: scoringRun,
      blind: nextBlind,
      tiles: removed,
      gained: gained.length,
      slotsBlocked,
      destroyedTiles,
    },
    scoringRun.jokers,
  ));
  if (destroyedTiles.length > 0) {
    for (const _tile of destroyedTiles) {
      growthTriggers.push(...defaultJokerBus.emit(
        'tilesDestroyed',
        { run: scoringRun, count: 1 },
        scoringRun.jokers,
      ));
    }
  }
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  const bossGoldDrain = Math.min(
    scoringRun.gold,
    removed.length * (boss?.goldPerDiscardedTile ?? 0),
  );

  const growthRun = recordLifecycleGrowth(scoringRun, growthTriggers);
  const resolvedRun = bossGoldDrain > 0
    ? { ...growthRun, gold: growthRun.gold - bossGoldDrain }
    : growthRun;
  return {
    run: resolvedRun,
    blind: nextBlind,
    jokers: resolvedRun.jokers,
    goldDelta: resolvedRun.gold - goldBefore,
    gained,
    slotsBlocked,
    discardedLetters: scoringRun.discardedLetters ?? [],
    discardedLetterCounts: scoringRun.discardedLetterCounts ?? {},
    bag: scoringRun.bag,
    destroyedTiles,
  };
}

export interface SubmitResult {
  blind: BlindState;
  submission: WordSubmission;
  /** ordered settle steps for the UI to replay (UI_DESIGN §4.1) */
  events: ScoreEvent[];
  /** run-gold change from this submission (The Taxman = −1; Lead plate material = +$20 on its 1/5 roll;
   *  goldPlay font seal = +BALANCE.fontEffectValues.goldPlay.gold per trigger); 0 normally */
  goldDelta: number;
  /** tiles destroyed by their material (Glass) — the caller removes them from run.bag */
  destroyedTileIds: string[];
  /** Wood tiles that scored this play and permanently gain +10 Chips. */
  grownWoodTileIds: string[];
  /** Fresh permanent tiles created by Emoji Tile hooks this play. */
  createdTiles: Tile[];
  /** Submitted physical tiles after permanent on-score/post-score mutations. */
  updatedTiles: Tile[];
  /** Tiles pulled from the post-play hand by the active boss (Unopened Letter). */
  bossDiscardedTiles: Tile[];
  /** cloned, state-updated owned Emoji Tiles */
  jokers: RunState['jokers'];
  /** Self-destroyed Emoji Tiles retained by the UI through their final trigger. */
  destroyedJokers: DestroyedJokerSnapshot[];
  /** run-wide counters updated by this successful submission */
  counters: RunState['counters'];
  /** unique valid words played across the run, including this submission */
  playedWords: string[];
  /** unique Word Hand ids made across the run, including this submission */
  playedLetterHands: NonNullable<RunState['playedLetterHands']>;
  /** run-wide Word Hand use counts, including this submission */
  letterHandPlayCounts: NonNullable<RunState['letterHandPlayCounts']>;
  /** most recently scored Word Hand, including this submission */
  lastLetterHand: LetterHandId | null;
  /** Distinct physical letters discarded across this run, including boss discards. */
  discardedLetters: Letter[];
  discardedLetterCounts: Partial<Record<Letter, number>>;
}

/** Resolve allowed-but-zero plays before any scoring hook or score RNG runs. */
export function isSubmissionDebuffed(
  submission: WordSubmission,
  run: RunState,
  blind: BlindState,
  lexicon: Lexicon,
  prior: readonly WordSubmission[] = blind.sequence,
): boolean {
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  return tagDebuffsSubmission(blind, submission) ||
    (boss?.debuffs?.(submission, { run, blind, lexicon }, prior) ?? false) ||
    (boss?.voids?.(submission, prior) ?? false);
}

const pushGrowthEvents = (
  target: ScoreEvent[],
  growth: readonly JokerGrowthTrigger[],
  tileId?: string,
) => {
  for (const trigger of growth) {
    target.push({
      kind: 'joker',
      jokerId: trigger.jokerId,
      ...(trigger.jokerInstanceId !== undefined
        ? { jokerInstanceId: trigger.jokerInstanceId }
        : {}),
      chipsDelta: 0,
      multDelta: 0,
      growthKind: trigger.kind,
      growthDelta: trigger.delta,
      ...(tileId ? { tileId } : {}),
    });
  }
};

export interface PreparedWordSubmission {
  base: BaseScore;
  submission: WordSubmission;
  ctx: WordScoringContext;
  ruleEvents: Extract<ScoreEvent, { kind: 'joker' }>[];
}

/** Run only the pure spelling/rule pass shared by preview, legality, and scoring. */
export function prepareWordSubmission(
  tiles: readonly Tile[],
  lexicon: Lexicon,
  run: RunState,
  blind: BlindState,
): PreparedWordSubmission {
  const ruleRun: RunState = {
    ...run,
    jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  const ruleBlind = { ...blind };
  const ruleEvents: Extract<ScoreEvent, { kind: 'joker' }>[] = [];
  const prepared = { run: ruleRun, blind: ruleBlind, tiles, spellingTiles: tiles.slice() };
  for (const joker of ruleRun.jokers) {
    const before = prepared.spellingTiles.map((tile) => `${tile.id}:${tile.letter}`).join('\0');
    const growth = defaultJokerBus.emit('wordPrepare', prepared, [joker]);
    if (prepared.spellingTiles.map((tile) => `${tile.id}:${tile.letter}`).join('\0') !== before) {
      ruleEvents.push({
        kind: 'joker', jokerId: joker.defId,
        ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
        chipsDelta: 0, multDelta: 0,
      });
    }
    pushGrowthEvents(ruleEvents, growth);
  }
  const base = baseScore(prepared.spellingTiles, lexicon);
  const submission: WordSubmission = {
    tiles: tiles.slice(),
    text: base.text,
    isGibberish: base.isGibberish,
    suit: base.suit,
    posUsed: null,
    settledScore: 0,
    scoringLength: tiles.length,
    structureText: letterString(prepared.spellingTiles),
  };
  const ctx: WordScoringContext = {
    submission,
    spellingTiles: prepared.spellingTiles,
    chips: 0,
    mult: base.mult,
    baseSuit: base.suit,
    goldDelta: 0,
    posTags: base.isGibberish ? [] : (lexicon.lookup(base.text)?.pos ?? []),
    scoringVowels: new Set(VOWELS),
    tileRetriggers: new Map(),
    tileRetriggerInstances: new Map(),
    resolvedJokerUnits: new Set(),
    scoringSuits: new Set(base.suit ? [base.suit] : []),
    scoreBonus: 0,
  };
  for (const joker of ruleRun.jokers) {
    const before = JSON.stringify([
      ctx.submission.suit,
      ctx.submission.scoringLength,
      [...(ctx.scoringVowels ?? [])],
      [...(ctx.scoringSuits ?? [])],
      [...(ctx.tileRetriggers ?? [])],
      [...(ctx.tileRetriggerInstances ?? [])],
    ]);
    const growth = defaultJokerBus.emit(
      'wordRules',
      { run: ruleRun, blind: ruleBlind, ctx },
      [joker],
    );
    const after = JSON.stringify([
      ctx.submission.suit,
      ctx.submission.scoringLength,
      [...(ctx.scoringVowels ?? [])],
      [...(ctx.scoringSuits ?? [])],
      [...(ctx.tileRetriggers ?? [])],
      [...(ctx.tileRetriggerInstances ?? [])],
    ]);
    if (after !== before) {
      ruleEvents.push({
        kind: 'joker', jokerId: joker.defId,
        ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
        chipsDelta: 0, multDelta: 0,
      });
    }
    pushGrowthEvents(ruleEvents, growth);
  }
  submission.effectiveSuits = [...(ctx.scoringSuits ?? [])];
  return { base, submission, ctx, ruleEvents };
}

/**
 * Layer 1 & 2: accumulate chips per tile, apply the suit mult, let jokers mutate
 * (wordScoring), settle chips × mult — recording an ordered ScoreEvent log along
 * the way. Jokers are emitted one at a time so each contribution is a captured
 * delta; the additive/independent nature of wordScoring hooks makes this
 * identical to the batch emit.
 */
function scoreSubmission(
  prepared: PreparedWordSubmission,
  lexicon: Lexicon,
  run: RunState,
  blind: BlindState,
  rng: Rng,
  heldOrder?: readonly string[],
): {
  submission: WordSubmission;
  events: ScoreEvent[];
  materialGold: number;
  destroyedTileIds: string[];
  grownWoodTileIds: string[];
  createdTiles: Tile[];
} {
  const jokerScoreFactors = (
    jokerId: string,
    beforeChips: number,
    afterChips: number,
    beforeMult: number,
    afterMult: number,
  ) => {
    const def = JOKER_REGISTRY.get(jokerId);
    return {
      ...(def?.chipsOperation === 'multiply' && beforeChips !== afterChips
        ? { chipsFactor: def.chipsDisplayFactor ?? afterChips / beforeChips }
        : {}),
      ...(def?.multOperation === 'multiply' && beforeMult !== 0 && beforeMult !== afterMult
        ? { multFactor: def.multDisplayFactor ?? afterMult / beforeMult }
        : {}),
    };
  };
  const events: ScoreEvent[] = [];
  const { base: b, submission, ctx, ruleEvents } = prepared;
  const tiles = submission.tiles;
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  if (isSubmissionDebuffed(submission, run, blind, lexicon)) {
    submission.debuffed = true;
    submission.posUsed = null;
    ctx.chips = 0;
    ctx.mult = 0;
    for (const joker of run.jokers) {
      const beforeChips = ctx.chips;
      const beforeMult = ctx.mult;
      defaultJokerBus.emit('debuffScoring', { run, blind, ctx }, [joker]);
      if (ctx.chips !== beforeChips || ctx.mult !== beforeMult) {
        events.push({
          kind: 'joker', jokerId: joker.defId,
          ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
          chipsDelta: ctx.chips - beforeChips,
          multDelta: ctx.mult - beforeMult,
        });
      }
    }
    const total = ctx.chips * ctx.mult;
    submission.settledScore = total;
    return {
      submission,
      events: [...events, { kind: 'settle', chips: ctx.chips, mult: ctx.mult, total }],
      materialGold: 0,
      destroyedTileIds: [],
      grownWoodTileIds: [],
      createdTiles: [],
    };
  }
  for (const tile of tiles) {
    const repeats = (blind.scarletLetters ?? []).filter((letter) => letter === tile.letter).length;
    for (let i = 0; i < repeats; i++) {
      const sources = ctx.tileRetriggers?.get(tile.id) ?? [];
      sources.push('scarletTag');
      ctx.tileRetriggers?.set(tile.id, sources);
    }
  }
  let materialGold = 0;
  const destroyedTileIds: string[] = [];
  const grownWoodTileIds: string[] = [];
  const createdTiles: Tile[] = [];
  for (const t of tiles) {
    const fontEffect = fontEffectOf(t.font);
    const fontRetriggers =
      fontEffect === 'retriggerPlay' ? BALANCE.fontEffectValues.retriggerPlay.extraTriggers : 0;
    const baseTriggers = 1 + fontRetriggers;

    for (
      let trig = 0;
      trig < baseTriggers + (ctx.tileRetriggers?.get(t.id)?.length ?? 0);
      trig++
    ) {
      // The retrigger beat announces the repeat BEFORE the repeated tile beat.
      if (trig > 0 && trig <= fontRetriggers) {
        events.push({
          kind: 'font', font: t.font, effect: 'retriggerPlay', tileId: t.id,
          chipsDelta: 0, multDelta: 0, goldDelta: 0,
        });
      } else if (trig > fontRetriggers) {
        const source = ctx.tileRetriggers?.get(t.id)?.[trig - fontRetriggers - 1]!;
        const sourceInstance = ctx.tileRetriggerInstances?.get(t.id)?.[
          trig - fontRetriggers - 1
        ];
        events.push(source === 'scarletTag'
          ? {
              kind: 'tag', tagId: 'scarletTag', tileId: t.id, retrigger: true,
              chipsDelta: 0, multDelta: 0,
            }
          : {
              kind: 'joker', jokerId: source, tileId: t.id, retrigger: true,
              ...(sourceInstance !== undefined ? { jokerInstanceId: sourceInstance } : {}),
              chipsDelta: 0, multDelta: 0,
            });
      }

      // A prior Gold trigger can grow this physical tile before its retrigger.
      // Re-read intrinsic Chips per beat; the already-passed beat is unchanged.
      const chips = tileBaseChips(t);
      ctx.chips += chips;
      events.push({ kind: 'tile', tileId: t.id, letter: t.letter, chips });

      const tileEdition = t.edition ?? 'base';
      const tileEditionDelta = applyEdition(ctx, tileEdition);
      if (tileEditionDelta) {
        events.push({
          kind: 'edition',
          edition: tileEdition,
          tileId: t.id,
          ...tileEditionDelta,
        });
      }

      const mat = applyTileMaterial(ctx, t, rng);
      if (mat) {
        materialGold += mat.side.goldDelta ?? 0;
        if (mat.side.destroy && !destroyedTileIds.includes(t.id)) {
          const destroying = {
            run,
            blind,
            ctx,
            tile: t,
            cause: 'glass' as const,
            cancelled: false,
          };
          for (const joker of run.jokers) {
            const beforeChips = ctx.chips;
            const beforeMult = ctx.mult;
            const beforeCancelled = destroying.cancelled;
            const growth = defaultJokerBus.emit('tileDestroying', destroying, [joker]);
            if (
              ctx.chips !== beforeChips ||
              ctx.mult !== beforeMult ||
              destroying.cancelled !== beforeCancelled
            ) {
              events.push({
                kind: 'joker',
                jokerId: joker.defId,
                ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
                tileId: t.id,
                chipsDelta: ctx.chips - beforeChips,
                multDelta: ctx.mult - beforeMult,
                ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
              });
            }
            pushGrowthEvents(events, growth, t.id);
          }
          if (!destroying.cancelled) destroyedTileIds.push(t.id);
          else if (mat.side.chanceResults) {
            mat.side.chanceResults = mat.side.chanceResults.map((result) =>
              result.label === 'destruction' ? { ...result, outcome: 'survived' } : result,
            );
          }
        }
        if (mat.side.growWood && !grownWoodTileIds.includes(t.id)) grownWoodTileIds.push(t.id);
        if (
          mat.chipsDelta !== 0 ||
          mat.multDelta !== 0 ||
          (mat.side.goldDelta ?? 0) !== 0 ||
          (mat.side.chanceResults?.length ?? 0) > 0
        ) {
          events.push({
            kind: 'material',
            material: t.material,
            tileId: t.id,
            chipsDelta: mat.chipsDelta,
            multDelta: mat.multDelta,
            ...(mat.multFactor !== undefined ? { multFactor: mat.multFactor } : {}),
            ...(mat.side.goldDelta !== undefined ? { goldDelta: mat.side.goldDelta } : {}),
            ...(mat.side.chanceResults ? { chanceResults: mat.side.chanceResults } : {}),
          });
        }
        const materialGrowth = defaultJokerBus.emit('materialScored', {
          run,
          blind,
          ctx,
          tile: t,
          triggerIndex: trig,
          chipsDelta: mat.chipsDelta,
          multDelta: mat.multDelta,
          goldDelta: mat.side.goldDelta ?? 0,
          grewWood: mat.side.growWood ?? false,
          chanceResults: mat.side.chanceResults ?? [],
        }, run.jokers);
        pushGrowthEvents(events, materialGrowth, t.id);
        if ((mat.side.goldDelta ?? 0) > 0) {
          for (const joker of run.jokers) {
            const beforeChips = ctx.chips;
            const beforeMult = ctx.mult;
            const beforeBonusChips = t.bonusChips ?? 0;
            const growth = defaultJokerBus.emit('tileGold', {
              run, blind, ctx, tile: t, gold: mat.side.goldDelta!,
            }, [joker]);
            const bonusGrowth = (t.bonusChips ?? 0) - beforeBonusChips;
            if (ctx.chips !== beforeChips || ctx.mult !== beforeMult || bonusGrowth !== 0) {
              events.push({
                kind: 'joker',
                jokerId: joker.defId,
                ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
                tileId: t.id,
                chipsDelta: ctx.chips - beforeChips,
                multDelta: ctx.mult - beforeMult,
                ...(bonusGrowth !== 0 ? { growthKind: 'chips' as const, growthDelta: bonusGrowth } : {}),
                ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
              });
            }
            pushGrowthEvents(events, growth, t.id);
          }
        }
      }

      // Font play effects fire per trigger, tile-level — so they fire on
      // gibberish too, like materials (GDD §2.3).
      if (fontEffect === 'goldPlay') {
        const gold = BALANCE.fontEffectValues.goldPlay.gold;
        materialGold += gold;
        for (const joker of run.jokers) {
          const beforeChips = ctx.chips;
          const beforeMult = ctx.mult;
          const beforeBonusChips = t.bonusChips ?? 0;
          const growth = defaultJokerBus.emit('tileGold', { run, blind, ctx, tile: t, gold }, [joker]);
          const bonusGrowth = (t.bonusChips ?? 0) - beforeBonusChips;
          if (ctx.chips !== beforeChips || ctx.mult !== beforeMult || bonusGrowth !== 0) {
            events.push({
              kind: 'joker',
              jokerId: joker.defId,
              ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
              tileId: t.id,
              chipsDelta: ctx.chips - beforeChips,
              multDelta: ctx.mult - beforeMult,
              ...(bonusGrowth !== 0 ? { growthKind: 'chips' as const, growthDelta: bonusGrowth } : {}),
              ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
            });
          }
          pushGrowthEvents(events, growth, t.id);
        }
        events.push({
          kind: 'font', font: t.font, effect: 'goldPlay', tileId: t.id,
          chipsDelta: 0, multDelta: 0, goldDelta: gold,
        });
      } else if (fontEffect === 'chipPlay') {
        const bonus = BALANCE.fontEffectValues.chipPlay.chips;
        ctx.chips += bonus;
        events.push({
          kind: 'font', font: t.font, effect: 'chipPlay', tileId: t.id,
          chipsDelta: bonus, multDelta: 0, goldDelta: 0,
        });
      }

      // Per-tile Emoji Tiles fire AS this tile scores, one at a time, so each
      // contribution interleaves with tiles. Per-word hooks stay below.
      // Retriggers compose: jokers fire again on each repeated trigger too (GDD §2.3).
      for (const joker of run.jokers) {
        const beforeChips = ctx.chips;
        const beforeMult = ctx.mult;
        const beforeGold = ctx.goldDelta ?? 0;
        const scoreBeats: JokerScoreBeat[] = [];
        const growth = defaultJokerBus.emit(
          'tileScoring',
          { run, blind, ctx, tile: t, scoreBeats },
          [joker],
        );
        const chipsDelta = ctx.chips - beforeChips;
        const multDelta = ctx.mult - beforeMult;
        const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
        if (scoreBeats.length > 0) {
          for (const beat of scoreBeats) {
            events.push({
              kind: 'joker', jokerId: joker.defId,
              ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
              tileId: t.id, ...beat,
            });
          }
        } else if (chipsDelta !== 0 || multDelta !== 0 || goldDelta !== 0) {
          events.push({
            kind: 'joker',
            jokerId: joker.defId,
            ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
            chipsDelta,
            multDelta,
            ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
            tileId: t.id,
            ...(goldDelta !== 0 ? { goldDelta } : {}),
          });
        }
        pushGrowthEvents(events, growth, t.id);
      }
    }
  }
  events.push({ kind: 'suit', suit: b.suit, mult: b.mult });

  // Word length adds Mult (GDD §3.1) — a whole-word stamp landing right after the
  // suit, so the Word Hand below stacks on top of it. Valid words only (§6.4).
  const scoringLength = submission.scoringLength ?? tiles.length;
  const lengthMult = wordLengthMult(scoringLength, submission.isGibberish);
  if (lengthMult !== 0) {
    ctx.mult += lengthMult;
    events.push({ kind: 'wordLength', letters: scoringLength, multDelta: lengthMult });
  }

  // Freeze tiles remaining in hand now; their effects land after every owned
  // Emoji Tile so Brass multiplies the current total Mult.
  const playedIds = new Set(tiles.map((t) => t.id));
  const heldUnordered = blind.hand.filter((t) => !playedIds.has(t.id));
  const held =
    heldOrder
      ? [
          ...heldOrder
            .map((id) => heldUnordered.find((tile) => tile.id === id))
            .filter((tile): tile is Tile => tile !== undefined),
          ...heldUnordered.filter((tile) => !heldOrder.includes(tile.id)),
        ]
      : heldUnordered;

  // Word Hand (A-2): highest single per-word structure bonus. Its Chips add to
  // the current word and its Mult multiplies the current word Mult.
  const letters = submissionLetterString(submission);
  const letterHand = evaluateLetterHand(
    letters,
    submission.isGibberish,
    scoringLength,
    run.letterHandLevels,
  );
  if (letterHand && (letterHand.chips !== 0 || letterHand.mult !== 0)) {
    const beforeMult = ctx.mult;
    ctx.chips += letterHand.chips;
    ctx.mult *= letterHand.mult;
    events.push({
      kind: 'letterHand',
      hand: letterHand.id,
      level: letterHand.level,
      chipsDelta: letterHand.chips,
      multDelta: ctx.mult - beforeMult,
      multFactor: letterHand.mult,
    });
  }

  for (const joker of run.jokers) {
    // Ultrasound disables the whole Emoji Tile, including its edition.
    if (joker.state.bossDisabled === 1) continue;
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    const beforeScore = ctx.scoreBonus ?? 0;
    const beforeGold = ctx.goldDelta ?? 0;
    const scoreBeats: JokerScoreBeat[] = [];
    const def = JOKER_REGISTRY.get(joker.defId);
    const growth = submission.isGibberish && !def?.scoresGibberish
      ? []
      : defaultJokerBus.emit(
          'wordScoring',
          { run, blind, ctx, scoreBeats, rng, createdTiles, lookup: (word) => lexicon.lookup(word) },
          [joker],
        );
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    const scoreDelta = (ctx.scoreBonus ?? 0) - beforeScore;
    const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
    if (scoreBeats.length > 0) {
      for (const beat of scoreBeats) {
        events.push({
          kind: 'joker', jokerId: joker.defId,
          ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
          ...beat,
        });
      }
    } else if (chipsDelta !== 0 || multDelta !== 0 || scoreDelta !== 0 || goldDelta !== 0) {
      events.push({
        kind: 'joker',
        jokerId: joker.defId,
        ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
        chipsDelta,
        multDelta,
        ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
        ...(scoreDelta !== 0 ? { scoreDelta } : {}),
        ...(goldDelta !== 0 ? { goldDelta } : {}),
      });
    }
    pushGrowthEvents(events, growth);
    const jokerEdition = joker.edition ?? 'base';
    const jokerEditionDelta = applyEdition(ctx, jokerEdition);
    if (jokerEditionDelta) {
      events.push({
        kind: 'edition',
        edition: jokerEdition,
        jokerId: joker.defId,
        ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
        ...jokerEditionDelta,
      });
    }
  }

  for (const tile of held) {
    for (const joker of run.jokers) {
      const beforeChips = ctx.chips;
      const beforeMult = ctx.mult;
      const beforeGold = ctx.goldDelta ?? 0;
      const growth = defaultJokerBus.emit(
        'heldTileScoring',
        { run, blind, ctx, tile },
        [joker],
      );
      const chipsDelta = ctx.chips - beforeChips;
      const multDelta = ctx.mult - beforeMult;
      const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
      if (chipsDelta !== 0 || multDelta !== 0 || goldDelta !== 0) {
        events.push({
          kind: 'joker',
          jokerId: joker.defId,
          ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
          tileId: tile.id,
          chipsDelta,
          multDelta,
          ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
          ...(goldDelta !== 0 ? { goldDelta } : {}),
        });
      }
      pushGrowthEvents(events, growth, tile.id);
    }
    for (const beat of applyHeldMaterials(ctx, [tile])) {
      events.push({ kind: 'material', ...beat });
    }
  }

  // Boss word-scoring effects run after jokers (GDD §8.3).
  if (boss?.wordScoring) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    boss.wordScoring(ctx, { run, blind, lexicon });
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      events.push({
        kind: 'boss',
        bossId: blind.bossId!,
        chipsDelta,
        multDelta,
        ...(chipsDelta !== 0 && boss.scoreFactors?.chips !== undefined
          ? { chipsFactor: boss.scoreFactors.chips }
          : {}),
        ...(multDelta !== 0 && boss.scoreFactors?.mult !== undefined
          ? { multFactor: boss.scoreFactors.mult }
          : {}),
      });
    }
  }

  for (const joker of run.jokers) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    const beforeGold = ctx.goldDelta ?? 0;
    const growth = defaultJokerBus.emit('wordChecked', { run, blind, ctx, debuffed: false }, [joker]);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
    if (chipsDelta !== 0 || multDelta !== 0 || goldDelta !== 0) {
      events.push({
        kind: 'joker',
        jokerId: joker.defId,
        ...(joker.instanceId !== undefined ? { jokerInstanceId: joker.instanceId } : {}),
        chipsDelta,
        multDelta,
        ...jokerScoreFactors(joker.defId, beforeChips, ctx.chips, beforeMult, ctx.mult),
        ...(goldDelta !== 0 ? { goldDelta } : {}),
      });
    }
    pushGrowthEvents(events, growth);
  }

  const balanced = balancePouchAxes(run, ctx.chips, ctx.mult);
  if (balanced.chips !== ctx.chips || balanced.mult !== ctx.mult) {
    const chipsDelta = balanced.chips - ctx.chips;
    const multDelta = balanced.mult - ctx.mult;
    ctx.chips = balanced.chips;
    ctx.mult = balanced.mult;
    events.push({ kind: 'pouch', pouchId: run.pouchId, chipsDelta, multDelta });
  }

  for (const event of ruleEvents) {
    if (!events.some(
      (candidate) => candidate.kind === 'joker' && candidate.jokerId === event.jokerId,
    )) events.push(event);
  }

  const total = ctx.chips * ctx.mult + (ctx.scoreBonus ?? 0);
  submission.settledScore = total;
  if (destroyedTileIds.length > 0) submission.destroyedTileIds = [...destroyedTileIds];
  // Presentation order is explicit and independent from the mutation order above:
  // whole-word stamps -> each played tile and its own effects -> Emoji Tiles in
  // shelf order -> held tiles in their frozen play-time order -> global/boss beats.
  const wholeWordEvents = events.filter(
    (event) => event.kind === 'suit' || event.kind === 'wordLength' || event.kind === 'letterHand',
  );
  const playedTileEvents = events.filter(
    (event) => 'tileId' in event && !!event.tileId && playedIds.has(event.tileId),
  );
  const emojiEvents = events.filter(
    (event) =>
      (event.kind === 'joker' || event.kind === 'edition') &&
      'jokerId' in event &&
      !!event.jokerId &&
      !('tileId' in event && event.tileId),
  );
  const heldIds = new Set(held.map((tile) => tile.id));
  const heldTileEvents = events.filter(
    (event) => 'tileId' in event && !!event.tileId && heldIds.has(event.tileId),
  );
  const claimed = new Set<ScoreEvent>([
    ...wholeWordEvents,
    ...playedTileEvents,
    ...emojiEvents,
    ...heldTileEvents,
  ]);
  const globalEvents = events.filter((event) => !claimed.has(event));
  const orderedEvents: ScoreEvent[] = [
    ...wholeWordEvents,
    ...playedTileEvents,
    ...emojiEvents,
    ...heldTileEvents,
    ...globalEvents,
    { kind: 'settle', chips: ctx.chips, mult: ctx.mult, total },
  ];
  return {
    submission,
    events: orderedEvents,
    materialGold: materialGold + (ctx.goldDelta ?? 0),
    destroyedTileIds,
    grownWoodTileIds,
    createdTiles,
  };
}

/** Layer 3: fold the pattern/unison bonus → jokers mutate (sentenceScoring) → total.
 *  Returns the post-hook breakdown so the UI can animate chips × mult (item 2). */
function scoreSentence(
  committed: number,
  sequence: readonly WordSubmission[],
  judgment: SentenceJudgment,
  run: RunState,
  blind: BlindState,
  lexicon: Lexicon,
): {
  total: number;
  sentenceChips: number;
  sentenceMult: number;
  breakdown: SentenceBonusBreakdown;
} {
  const base = finalizeScore(committed, judgment, run.patternLevels);
  const scoringSequence = sentenceSequenceForBlind(blind, sequence);
  // Preserve the legacy empty-sequence Broken Sentence case; only an actual
  // all-debuffed play history suppresses sentence hooks.
  const hasEligibleSubmission = sequence.length === 0 ||
    sequence.some((submission) => !submission.debuffed);
  const ctx: SentenceScoringContext = {
    sequence: scoringSequence,
    match: judgment.match,
    unison: judgment.unison,
    totalBefore: committed,
    sentenceChips: base.sentenceChips,
    sentenceMult: base.sentenceMult,
    scoreBonus: 0,
    jokerTriggers: [],
  };
  if (hasEligibleSubmission) {
    defaultJokerBus.emit(
      'sentenceScoring',
      { run, blind, ctx, lookup: (word) => lexicon.lookup(word) },
      run.jokers,
    );
  }
  ctx.sentenceMult *= constellationPassiveFactor(run, ctx.match?.pattern ?? null);
  // Boss sentence effects run after jokers (The Anarchist voids the bonus).
  if (hasEligibleSubmission && blind.bossId) {
    BOSS_REGISTRY.get(blind.bossId)?.sentenceScoring?.(ctx);
  }
  const effectChips = ctx.sentenceChips - base.sentenceChips;
  const effectMult = ctx.sentenceMult / base.sentenceMult;
  const effectScore = ctx.scoreBonus ?? 0;
  let pouchId: RunState['pouchId'] | null = null;
  let pouchChipsDelta = 0;
  let pouchMultDelta = 0;
  if (ctx.sentenceChips !== 0 && ctx.sentenceMult !== 0) {
    const beforeChips = ctx.sentenceChips;
    const beforeMult = ctx.sentenceMult;
    const balanced = balancePouchAxes(run, ctx.sentenceChips, ctx.sentenceMult);
    ctx.sentenceChips = balanced.chips;
    ctx.sentenceMult = balanced.mult;
    pouchChipsDelta = balanced.chips - beforeChips;
    pouchMultDelta = balanced.mult - beforeMult;
    if (pouchChipsDelta !== 0 || pouchMultDelta !== 0) pouchId = run.pouchId;
  }
  const unison = judgment.unison
    ? BALANCE.unison[judgment.unison.suit] as { chips?: number; mult?: number }
    : null;
  return {
    total: sentenceTotal(ctx.totalBefore, ctx.sentenceChips, ctx.sentenceMult) + (ctx.scoreBonus ?? 0),
    sentenceChips: ctx.sentenceChips,
    sentenceMult: ctx.sentenceMult,
    breakdown: {
      modifierCount: judgment.match?.absorbedModifiers ?? 0,
      modifierChips:
        (judgment.match?.absorbedModifiers ?? 0) * BALANCE.modifierAbsorption.chips,
      unisonSuit: judgment.unison?.suit ?? null,
      unisonChips: unison?.chips ?? 0,
      unisonMult: unison?.mult ?? 1,
      effectChips,
      effectMult,
      effectScore,
      ...(ctx.jokerTriggers && ctx.jokerTriggers.length > 0
        ? { jokerTriggers: ctx.jokerTriggers }
        : {}),
      pouchId,
      pouchChipsDelta,
      pouchMultDelta,
    },
  };
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
  heldOrder?: readonly string[],
): SubmitResult {
  if (blind.phasesUsed >= blind.phasesTotal) {
    throw new Error('no phases remain in this blind');
  }
  if (blind.forcedTileId && !tileIds.includes(blind.forcedTileId)) {
    throw new Error('boss: forced tile must be submitted');
  }
  const used = takeFromHand(blind.hand, tileIds)
    .map((tile) => ({ ...tile })); // mutable scoring copy; inputs remain snapshots

  const scoringRun: RunState = {
    ...run,
    jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  const prepared = prepareWordSubmission(used, lexicon, scoringRun, blind);

  // Boss legality (Stereotype Plate) uses the same prepared word as scoring.
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  if (boss?.blocks?.(prepared.submission, { run: scoringRun, blind, lexicon })) {
    throw new Error('boss: this word cannot be submitted');
  }

  const {
    submission,
    events,
    materialGold,
    destroyedTileIds,
    grownWoodTileIds,
    createdTiles,
  } = scoreSubmission(
    prepared,
    lexicon,
    scoringRun,
    blind,
    rng,
    heldOrder,
  );
  if (destroyedTileIds.length > 0) {
    const settle = events.at(-1)?.kind === 'settle' ? events.pop() : undefined;
    for (const tileId of destroyedTileIds) {
      scoringRun.bag = scoringRun.bag.filter((tile) => tile.id !== tileId);
      const growth = defaultJokerBus.emit(
        'tilesDestroyed',
        { run: scoringRun, count: 1 },
        scoringRun.jokers,
      );
      pushGrowthEvents(events, growth, tileId);
    }
    if (settle) events.push(settle);
  }
  // Economy drain: Bond charges once per hand played, regardless of tile count.
  const bossGoldDrain = boss?.goldPerWord ? -boss.goldPerWord : 0;
  const goldDelta = bossGoldDrain + materialGold;

  const usedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !usedIds.has(t.id));
  // Draw back UP TO the hand size (feedback #9), filling any empty slots — not just the
  // number played. Equivalent to draw-per-played when the hand was full going in.
  const need = Math.max(0, effectiveHandSize(run, blind) - keptHand.length);
  const { drawn, bag } = drawTiles(blind.bag, need);

  // Build the post-phase blind first so layer-3 hooks read phases remaining correctly.
  let afterBlind: BlindState = {
    ...blind,
    hand: [...keptHand, ...drawn, ...createdTiles],
    bag,
    // used tiles are spent for the blind; they return to the bag at blind end (§6.1)
    discardedThisBlind: [...blind.discardedThisBlind, ...used],
    sequence: [...blind.sequence, submission],
    committedScore: blind.committedScore + submission.settledScore,
    projectedScore: 0,
    phasesUsed: blind.phasesUsed + 1,
  };
  if (!submission.debuffed) {
    const enhancedTiles: NonNullable<import('./events').EngineEvents['tilesPlayed']['enhancedTiles']> = [];
    const survivingTiles = used.filter((tile) => !destroyedTileIds.includes(tile.id));
    defaultJokerBus.emit(
      'tilesPlayed',
      { run: scoringRun, blind: afterBlind, tiles: survivingTiles, enhancedTiles },
      scoringRun.jokers,
    );
    const settle = enhancedTiles.length > 0 && events.at(-1)?.kind === 'settle'
      ? events.pop()
      : undefined;
    for (const enhancement of enhancedTiles) {
      events.push({
        kind: 'joker', jokerId: enhancement.jokerId, tileId: enhancement.tile.id,
        ...(enhancement.jokerInstanceId !== undefined
          ? { jokerInstanceId: enhancement.jokerInstanceId }
          : {}),
        chipsDelta: 0, multDelta: 0,
      });
      const growth = defaultJokerBus.emit(
        'tilesEnhanced', { run: scoringRun, count: 1 }, scoringRun.jokers,
      );
      pushGrowthEvents(events, growth, enhancement.tile.id);
    }
    if (settle) events.push(settle);
    if (createdTiles.length > 0) {
      const settle = events.at(-1)?.kind === 'settle' ? events.pop() : undefined;
      for (const tile of createdTiles) {
        const growth = defaultJokerBus.emit(
          'tilesCreated', { run: scoringRun, count: 1 }, scoringRun.jokers,
        );
        pushGrowthEvents(events, growth, tile.id);
      }
      if (settle) events.push(settle);
    }
  }

  // Unopened Letter (미개봉 편지): after each play, discard up to N random hand tiles;
  // they exit play for the blind (§6.3) and are replaced from the remaining bag.
  let bossDiscardedTiles: Tile[] = [];
  if (boss?.discardOnPlay && afterBlind.hand.length > 0) {
    const n = Math.min(boss.discardOnPlay, afterBlind.hand.length);
    const dumped = rng.shuffle(afterBlind.hand).slice(0, n);
    bossDiscardedTiles = dumped;
    const dumpedIds = new Set(dumped.map((t) => t.id));
    const kept = afterBlind.hand.filter((t) => !dumpedIds.has(t.id));
    const refill = drawTiles(afterBlind.bag, dumped.length);
    afterBlind = {
      ...afterBlind,
      hand: [...kept, ...refill.drawn],
      bag: refill.bag,
      discardedThisBlind: [...afterBlind.discardedThisBlind, ...dumped],
    };
    if (!submission.debuffed) {
      Object.assign(scoringRun, withDiscardedLetters(scoringRun, dumped));
      for (const tile of dumped) {
        defaultJokerBus.emit(
          'tilesDiscarded',
          { run: scoringRun, blind: afterBlind, tiles: [tile] },
          scoringRun.jokers,
        );
      }
    }
  }

  // Finisher state rotates only after the current word has fully scored. Nokdo
  // selects from the replacement hand; Ultrasound changes the disabled Emoji Tile.
  const destroyedJokers: DestroyedJokerSnapshot[] = scoringRun.jokers.flatMap(
    (joker, index) => joker.state.destroyed === 1 ? [{ joker, index }] : [],
  );
  const afterBoss = afterBossPlay(
    pruneEchoNamespaces({
      ...scoringRun,
      jokers: scoringRun.jokers.filter((joker) => joker.state.destroyed !== 1),
    }),
    afterBlind,
    rng,
  );
  const priorWords = afterBoss.run.playedWords ?? [];
  const playedWord = submission.text.toLowerCase();
  const playedWords = submission.debuffed || submission.isGibberish || priorWords.includes(playedWord)
    ? priorWords
    : [...priorWords, playedWord];
  const priorHands = afterBoss.run.playedLetterHands ?? [];
  const playedHand = submission.debuffed
    ? undefined
    : evaluateLetterHand(
        submissionLetterString(submission),
        submission.isGibberish,
        submission.scoringLength,
      )?.id;
  const playedLetterHands = !playedHand || priorHands.includes(playedHand)
    ? priorHands
    : [...priorHands, playedHand];
  const letterHandPlayCounts = { ...afterBoss.run.letterHandPlayCounts };
  if (playedHand) {
    letterHandPlayCounts[playedHand] = (letterHandPlayCounts[playedHand] ?? 0) + 1;
  }
  const postBossRun: RunState = {
    ...afterBoss.run,
    playedWords,
    playedLetterHands,
    letterHandPlayCounts,
    lastLetterHand: playedHand ?? afterBoss.run.lastLetterHand ?? null,
    counters: {
      ...afterBoss.run.counters,
      totalWords: afterBoss.run.counters.totalWords + (submission.debuffed ? 0 : 1),
    },
  };
  afterBlind = afterBoss.blind;
  if (!submission.debuffed) {
    defaultJokerBus.emit(
      'wordScored',
      { run: postBossRun, blind: afterBlind, index: afterBlind.sequence.length - 1 },
      postBossRun.jokers,
    );
  }
  const committedScore = afterBlind.committedScore;
  const sequence = afterBlind.sequence;

  // Re-judge the WHOLE sequence and overwrite the projection (GDD §7.1) — the
  // sentence bonus is a projection, never accumulated per phase.
  const judgment = judgeSentence(sentenceSequenceForBlind(afterBlind, sequence), lexicon);
  const projectedScore = scoreSentence(
    committedScore,
    sequence,
    judgment,
    postBossRun,
    afterBlind,
    lexicon,
  ).total;

  return {
    submission,
    events,
    goldDelta,
    destroyedTileIds,
    grownWoodTileIds,
    createdTiles,
    updatedTiles: submission.tiles.map((tile) => ({ ...tile })),
    bossDiscardedTiles,
    jokers: postBossRun.jokers,
    destroyedJokers,
    counters: postBossRun.counters,
    playedWords: postBossRun.playedWords ?? [],
    playedLetterHands: postBossRun.playedLetterHands ?? [],
    letterHandPlayCounts: postBossRun.letterHandPlayCounts ?? {},
    lastLetterHand: postBossRun.lastLetterHand ?? null,
    discardedLetters: postBossRun.discardedLetters ?? [],
    discardedLetterCounts: postBossRun.discardedLetterCounts ?? {},
    blind: { ...afterBlind, projectedScore },
  };
}

export interface EndBlindResult {
  judgment: SentenceJudgment;
  /** the settled blind score after finalizing the sentence bonus (GDD §7.4) */
  finalScore: number;
  /** the sentence bonus' Chips side, post joker/boss hooks (item 2 animation) */
  sentenceChips: number;
  /** the sentence bonus' Mult side, post joker/boss hooks (item 2 animation) */
  sentenceMult: number;
  /** score gained by applying the sentence Chips and Mult to the committed score */
  bonus: number;
  /** visual source rows for modifiers, Unison, and post-pattern effects */
  breakdown: SentenceBonusBreakdown;
  /** unused phases → gold on ending (economy lands in slice ⑤) */
  phasesLeft: number;
  /** gold from materials held in hand at blind end (Ivory). The CALLER applies it —
   *  endBlind is pure and is called more than once per blind (useGame.ts:273, 594). */
  materialGold: number;
}

/**
 * Finalize the blind (GDD §7.4): judge the final sequence, add its Chips to the
 * committed score, and apply its Mult. Tiles need no explicit return — each blind
 * reshuffles the run's permanent bag from scratch, so used tiles are back next
 * blind automatically (§6.1, §6.6).
 */
export function endBlind(blind: BlindState, run: RunState, lexicon: Lexicon): EndBlindResult {
  const judgment = judgeSentence(sentenceSequenceForBlind(blind), lexicon);
  const scored = scoreSentence(blind.committedScore, blind.sequence, judgment, run, blind, lexicon);
  return {
    judgment,
    finalScore: scored.total,
    sentenceChips: scored.sentenceChips,
    sentenceMult: scored.sentenceMult,
    bonus: scored.total - blind.committedScore,
    breakdown: scored.breakdown,
    phasesLeft: blind.phasesTotal - blind.phasesUsed,
    materialGold: collectBlindEndMaterials(blind.hand),
  };
}
