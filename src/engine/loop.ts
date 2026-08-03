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
import { baseScore, spell, letterString, wordLengthMult } from './scoring';
import { applyTileMaterial, applyHeldMaterials, collectBlindEndMaterials } from './materials';
import { applyEdition } from './editions';
import { finalizeScore, judgeSentence } from './patterns';
import { evaluateLetterHand } from './letterHands';
import { fontEffectOf, rollDiscardGains } from './fonts';
import { defaultJokerBus, JOKER_REGISTRY } from './jokers';
import { afterBossPlay, BOSS_REGISTRY, bossPoolForAnte, drawBoss } from './bosses';
import { effectiveBlindTarget } from './economy';
import { kindForIndex } from './progression';
import { constellationPassiveFactor } from './vouchers';
import { balancePouchAxes } from './pouches';
import { EMPTY_NEXT_BLIND_BONUS } from './skipRewards';
import type {
  BlindKind,
  BlindState,
  ConsumableId,
  Letter,
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
}

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
  defaultJokerBus.emit(
    'discardUsed',
    { run: scoringRun, blind: nextBlind, tiles: removed, gained: gained.length, slotsBlocked },
    scoringRun.jokers,
  );

  return {
    blind: nextBlind,
    jokers: scoringRun.jokers,
    goldDelta: scoringRun.gold - goldBefore,
    gained,
    slotsBlocked,
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
  /** Tiles pulled from the post-play hand by the active boss (Unopened Letter). */
  bossDiscardedTiles: Tile[];
  /** cloned, state-updated owned Emoji Tiles */
  jokers: RunState['jokers'];
  /** run-wide counters updated by this successful submission */
  counters: RunState['counters'];
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
  heldOrder?: readonly string[],
): {
  submission: WordSubmission;
  events: ScoreEvent[];
  materialGold: number;
  destroyedTileIds: string[];
  grownWoodTileIds: string[];
} {
  const jokerMultFactor = (jokerId: string, before: number, after: number) =>
    JOKER_REGISTRY.get(jokerId)?.multOperation === 'multiply' && before !== 0 && before !== after
      ? { multFactor: after / before }
      : {};
  const ruleEvents: Extract<ScoreEvent, { kind: 'joker' }>[] = [];
  const events: ScoreEvent[] = [];
  const prepared = { run, blind, tiles, spellingTiles: tiles.slice() };
  for (const joker of run.jokers) {
    const before = prepared.spellingTiles.map((tile) => tile.id).join('\0');
    defaultJokerBus.emit('wordPrepare', prepared, [joker]);
    if (prepared.spellingTiles.map((tile) => tile.id).join('\0') !== before) {
      ruleEvents.push({
        kind: 'joker', jokerId: joker.defId, chipsDelta: 0, multDelta: 0,
      });
    }
  }
  const b = baseScore(prepared.spellingTiles, lexicon);
  const submission: WordSubmission = {
    tiles: tiles.slice(),
    text: b.text,
    isGibberish: b.isGibberish,
    suit: b.suit,
    posUsed: null,
    settledScore: 0,
  };
  const ctx: WordScoringContext = {
    submission,
    chips: 0,
    mult: b.mult,
    goldDelta: 0,
    posTags: b.isGibberish ? [] : (lexicon.lookup(b.text)?.pos ?? []),
    scoringVowels: new Set(VOWELS),
    tileRetriggers: new Map(),
    scoringSuits: new Set(b.suit ? [b.suit] : []),
    scoreBonus: 0,
  };
  for (const joker of run.jokers) {
    const before = JSON.stringify([
      [...(ctx.scoringVowels ?? [])],
      [...(ctx.scoringSuits ?? [])],
      [...(ctx.tileRetriggers ?? [])],
    ]);
    defaultJokerBus.emit('wordRules', { run, blind, ctx }, [joker]);
    const after = JSON.stringify([
      [...(ctx.scoringVowels ?? [])],
      [...(ctx.scoringSuits ?? [])],
      [...(ctx.tileRetriggers ?? [])],
    ]);
    if (after !== before) {
      ruleEvents.push({
        kind: 'joker', jokerId: joker.defId, chipsDelta: 0, multDelta: 0,
      });
    }
  }
  let materialGold = 0;
  const destroyedTileIds: string[] = [];
  const grownWoodTileIds: string[] = [];
  for (const t of tiles) {
    const chips = t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
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
        events.push({
          kind: 'joker',
          jokerId: ctx.tileRetriggers?.get(t.id)?.[trig - fontRetriggers - 1]!,
          tileId: t.id,
          chipsDelta: 0,
          multDelta: 0,
        });
      }

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
            defaultJokerBus.emit('tileDestroying', destroying, [joker]);
            if (
              ctx.chips !== beforeChips ||
              ctx.mult !== beforeMult ||
              destroying.cancelled !== beforeCancelled
            ) {
              events.push({
                kind: 'joker',
                jokerId: joker.defId,
                tileId: t.id,
                chipsDelta: ctx.chips - beforeChips,
                multDelta: ctx.mult - beforeMult,
                ...jokerMultFactor(joker.defId, beforeMult, ctx.mult),
              });
            }
          }
          if (!destroying.cancelled) destroyedTileIds.push(t.id);
        }
        if (mat.side.growWood && !grownWoodTileIds.includes(t.id)) grownWoodTileIds.push(t.id);
        if (mat.chipsDelta !== 0 || mat.multDelta !== 0) {
          events.push({
            kind: 'material',
            material: t.material,
            tileId: t.id,
            chipsDelta: mat.chipsDelta,
            multDelta: mat.multDelta,
            ...(mat.multFactor !== undefined ? { multFactor: mat.multFactor } : {}),
          });
        }
        defaultJokerBus.emit('materialScored', {
          run,
          blind,
          ctx,
          tile: t,
          triggerIndex: trig,
          chipsDelta: mat.chipsDelta,
          multDelta: mat.multDelta,
          goldDelta: mat.side.goldDelta ?? 0,
          grewWood: mat.side.growWood ?? false,
        }, run.jokers);
        if ((mat.side.goldDelta ?? 0) > 0) {
          for (const joker of run.jokers) {
            const beforeChips = ctx.chips;
            const beforeMult = ctx.mult;
            defaultJokerBus.emit('tileGold', {
              run, blind, ctx, tile: t, gold: mat.side.goldDelta!,
            }, [joker]);
            if (ctx.chips !== beforeChips || ctx.mult !== beforeMult) {
              events.push({
                kind: 'joker',
                jokerId: joker.defId,
                tileId: t.id,
                chipsDelta: ctx.chips - beforeChips,
                multDelta: ctx.mult - beforeMult,
                ...jokerMultFactor(joker.defId, beforeMult, ctx.mult),
              });
            }
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
          defaultJokerBus.emit('tileGold', { run, blind, ctx, tile: t, gold }, [joker]);
          if (ctx.chips !== beforeChips || ctx.mult !== beforeMult) {
            events.push({
              kind: 'joker',
              jokerId: joker.defId,
              tileId: t.id,
              chipsDelta: ctx.chips - beforeChips,
              multDelta: ctx.mult - beforeMult,
              ...jokerMultFactor(joker.defId, beforeMult, ctx.mult),
            });
          }
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
        defaultJokerBus.emit('tileScoring', { run, blind, ctx, tile: t }, [joker]);
        const chipsDelta = ctx.chips - beforeChips;
        const multDelta = ctx.mult - beforeMult;
        const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
        if (chipsDelta !== 0 || multDelta !== 0 || goldDelta !== 0) {
          events.push({
            kind: 'joker',
            jokerId: joker.defId,
            chipsDelta,
            multDelta,
            ...jokerMultFactor(joker.defId, beforeMult, ctx.mult),
            tileId: t.id,
            ...(goldDelta !== 0 ? { goldDelta } : {}),
          });
        }
      }
    }
  }
  events.push({ kind: 'suit', suit: b.suit, mult: b.mult });

  // Word length adds Mult (GDD §3.1) — a whole-word stamp landing right after the
  // suit, so the letter hand below stacks on top of it. Valid words only (§6.4).
  const lengthMult = wordLengthMult(tiles.length, submission.isGibberish);
  if (lengthMult !== 0) {
    ctx.mult += lengthMult;
    events.push({ kind: 'wordLength', letters: tiles.length, multDelta: lengthMult });
  }

  // Brass and friends read tiles REMAINING in hand — blind.hand still holds the
  // played tiles at this point, so exclude them explicitly.
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
  for (const beat of applyHeldMaterials(ctx, held)) {
    events.push({ kind: 'material', ...beat });
  }

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
    // Ultrasound disables the whole Emoji Tile, including its edition.
    if (joker.state.bossDisabled === 1) continue;
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    const beforeScore = ctx.scoreBonus ?? 0;
    const beforeGold = ctx.goldDelta ?? 0;
    defaultJokerBus.emit('wordScoring', { run, blind, ctx }, [joker]);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    const scoreDelta = (ctx.scoreBonus ?? 0) - beforeScore;
    const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
    if (chipsDelta !== 0 || multDelta !== 0 || scoreDelta !== 0 || goldDelta !== 0) {
      events.push({
        kind: 'joker',
        jokerId: joker.defId,
        chipsDelta,
        multDelta,
        ...jokerMultFactor(joker.defId, beforeMult, ctx.mult),
        ...(scoreDelta !== 0 ? { scoreDelta } : {}),
        ...(goldDelta !== 0 ? { goldDelta } : {}),
      });
    }
    const jokerEdition = joker.edition ?? 'base';
    const jokerEditionDelta = applyEdition(ctx, jokerEdition);
    if (jokerEditionDelta) {
      events.push({
        kind: 'edition',
        edition: jokerEdition,
        jokerId: joker.defId,
        ...jokerEditionDelta,
      });
    }
  }

  // Boss word-scoring effects run after jokers (GDD §8.3).
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  if (boss?.wordScoring) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    boss.wordScoring(ctx, { run, blind, lexicon });
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      events.push({ kind: 'boss', bossId: blind.bossId!, chipsDelta, multDelta });
    }
  }

  const debuffed =
    (boss?.debuffs?.(submission, { run, blind, lexicon }, blind.sequence) ?? false) ||
    (boss?.voids?.(submission, blind.sequence) ?? false);
  for (const joker of run.jokers) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    const beforeGold = ctx.goldDelta ?? 0;
    defaultJokerBus.emit('wordChecked', { run, blind, ctx, debuffed }, [joker]);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    const goldDelta = (ctx.goldDelta ?? 0) - beforeGold;
    if (chipsDelta !== 0 || multDelta !== 0 || goldDelta !== 0) {
      events.push({
        kind: 'joker',
        jokerId: joker.defId,
        chipsDelta,
        multDelta,
        ...jokerMultFactor(joker.defId, beforeMult, ctx.mult),
        ...(goldDelta !== 0 ? { goldDelta } : {}),
      });
    }
  }

  const balanced = balancePouchAxes(run, ctx.chips, ctx.mult);
  if (balanced.chips !== ctx.chips || balanced.mult !== ctx.mult) {
    const chipsDelta = balanced.chips - ctx.chips;
    const multDelta = balanced.mult - ctx.mult;
    ctx.chips = balanced.chips;
    ctx.mult = balanced.mult;
    events.push({ kind: 'pouch', pouchId: run.pouchId, chipsDelta, multDelta });
  }

  if (debuffed) {
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    ctx.chips = 0;
    ctx.mult = 0;
    submission.debuffed = true;
    if (beforeChips !== 0 || beforeMult !== 0) {
      events.push({
        kind: 'boss',
        bossId: blind.bossId!,
        chipsDelta: -beforeChips,
        multDelta: -beforeMult,
      });
    }
  }

  for (const event of ruleEvents) {
    if (!events.some(
      (candidate) => candidate.kind === 'joker' && candidate.jokerId === event.jokerId,
    )) events.push(event);
  }

  const total = ctx.chips * ctx.mult + (ctx.scoreBonus ?? 0);
  submission.settledScore = total;
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
  const ctx: SentenceScoringContext = {
    sequence: sequence.slice(),
    match: judgment.match,
    unison: judgment.unison,
    totalBefore: committed,
    sentenceChips: base.sentenceChips,
    sentenceMult: base.sentenceMult,
  };
  defaultJokerBus.emit(
    'sentenceScoring',
    { run, blind, ctx, lookup: (word) => lexicon.lookup(word) },
    run.jokers,
  );
  ctx.sentenceMult *= constellationPassiveFactor(run, ctx.match?.pattern ?? null);
  // Boss sentence effects run after jokers (The Anarchist voids the bonus).
  if (blind.bossId) BOSS_REGISTRY.get(blind.bossId)?.sentenceScoring?.(ctx);
  const effectChips = ctx.sentenceChips - base.sentenceChips;
  const effectMult = ctx.sentenceMult / base.sentenceMult;
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
    total: ctx.totalBefore + ctx.sentenceChips * ctx.sentenceMult,
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
  const used = takeFromHand(blind.hand, tileIds); // validates membership, keeps order

  // Boss legality (kept as infra; no current-roster boss blocks) + economy drains.
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  if (boss?.blocks?.(spell(used), lexicon)) {
    throw new Error('boss: this word cannot be submitted');
  }

  const scoringRun: RunState = {
    ...run,
    jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  const { submission, events, materialGold, destroyedTileIds, grownWoodTileIds } = scoreSubmission(
    used,
    lexicon,
    scoringRun,
    blind,
    rng,
    heldOrder,
  );
  // Economy drains: −goldPerWord flat, −goldPerTile per tile played (Bond).
  const bossGoldDrain =
    (boss?.goldPerWord ? -boss.goldPerWord : 0) +
    (boss?.goldPerTile ? -boss.goldPerTile * used.length : 0);
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
    hand: [...keptHand, ...drawn],
    bag,
    // used tiles are spent for the blind; they return to the bag at blind end (§6.1)
    discardedThisBlind: [...blind.discardedThisBlind, ...used],
    sequence: [...blind.sequence, submission],
    committedScore: blind.committedScore + submission.settledScore,
    projectedScore: 0,
    phasesUsed: blind.phasesUsed + 1,
  };

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
  }

  // Finisher state rotates only after the current word has fully scored. Nokdo
  // selects from the replacement hand; Ultrasound changes the disabled Emoji Tile.
  const afterBoss = afterBossPlay(
    {
      ...scoringRun,
      jokers: scoringRun.jokers.filter((joker) => joker.state.destroyed !== 1),
    },
    afterBlind,
    rng,
  );
  const postBossRun: RunState = {
    ...afterBoss.run,
    counters: {
      ...afterBoss.run.counters,
      totalWords: afterBoss.run.counters.totalWords + 1,
    },
  };
  afterBlind = afterBoss.blind;
  defaultJokerBus.emit(
    'wordScored',
    { run: postBossRun, blind: afterBlind, index: afterBlind.sequence.length - 1 },
    postBossRun.jokers,
  );
  const committedScore = afterBlind.committedScore;
  const sequence = afterBlind.sequence;

  // Re-judge the WHOLE sequence and overwrite the projection (GDD §7.1) — the
  // sentence bonus is a projection, never accumulated per phase.
  const judgment = judgeSentence(sequence, lexicon);
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
    bossDiscardedTiles,
    jokers: postBossRun.jokers,
    counters: postBossRun.counters,
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
  /** the bonus itself: sentenceChips × sentenceMult */
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
 * Finalize the blind (GDD §7.4): judge the final sequence and fold the sentence
 * bonus into the committed total. Tiles need no explicit return — each blind
 * reshuffles the run's permanent bag from scratch, so used tiles are back next
 * blind automatically (§6.1, §6.6).
 */
export function endBlind(blind: BlindState, run: RunState, lexicon: Lexicon): EndBlindResult {
  const judgment = judgeSentence(blind.sequence, lexicon);
  const scored = scoreSentence(blind.committedScore, blind.sequence, judgment, run, blind, lexicon);
  return {
    judgment,
    finalScore: scored.total,
    sentenceChips: scored.sentenceChips,
    sentenceMult: scored.sentenceMult,
    bonus: scored.sentenceChips * scored.sentenceMult,
    breakdown: scored.breakdown,
    phasesLeft: blind.phasesTotal - blind.phasesUsed,
    materialGold: collectBlindEndMaterials(blind.hand),
  };
}
