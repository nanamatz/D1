/**
 * The game controller. Owns run + blind state and routes every action through
 * the headless engine. Randomness is reproducible: a fresh seeded RNG per
 * random op, keyed `seed#counter`, so no stateful RNG ref is needed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { newRun } from '../engine/run';
import { makeRng } from '../engine/rng';
import { startBlind, enterJokerBlind, submitWord, discardTiles, endBlind, blindExhausted } from '../engine/loop';
import { resolveBlind, type BlindEarnings } from '../engine/progression';
import {
  bossPoolForAnte,
  bossPoolForId,
  drawBossFromCycle,
  enterBossBlind,
  reconcileBossHand,
} from '../engine/bosses';
import { tutorialBus, hasSeenIntro, TUTORIAL_WORD } from './tutorial';
import { readTips } from './settings';
import { checkWordPlayed, unlockBus } from './unlocks';
import type {
  BlindKind,
  BlindState,
  ChanceResult,
  ChallengeId,
  ConsumableId,
  Letter,
  PatternId,
  PouchId,
  RecordId,
  RunState,
  ScoreEvent,
  SentenceBonusBreakdown,
  ShopState,
  SkipRewardId,
  Tile,
} from '../engine/types';
import type { DestroyedJokerSnapshot } from '../engine/events';
import {
  prepareShop,
  buyItem,
  sellJoker,
  repriceShop,
  rerollShop,
  currentRerollCost,
  buyVoucher,
  rollVoucherOffer,
  rollExtraItem,
} from '../engine/shop';
import { consumableSellValue, packBuyPrice } from '../engine/economy';
import { rollPack, applyPackPick, type PackOffer } from '../engine/packs';
import { BALANCE } from '../engine/balance';
import { letterChips } from '../engine/scoring';
import { findSpellableWords, type HintWord } from '../engine/hint';
import type { Lexicon } from '../engine/lexicon';
import { recordWord } from './collection';
import {
  discoverLetterHand,
  isLetterHandDiscovered,
  loadDiscoveredLetterHands,
  recordBestRoundScore,
  recordEndlessEnd,
  recordJokerBlindCounts,
  recordRunEnd,
} from './lifetime';
import { LETTER_HAND_REGISTRY } from '../engine/letterHands';
import { clearRun, loadRun, serializeRun, writeRun } from './persist';
import { reorderIds, type MessageSpec, type Phase } from './game';
import { audio } from './audio';
import { motionOff } from './motion';
import { patternLevelBus } from './patternLevel';
import { recordVoucherProgress, unlockedVoucherSet } from './voucherProgress';
import { recordEmojiUnlockEvent, shopEmojiSet, unlockedEmojiSet } from './emojiUnlocks';
import {
  canUseFable,
  canUseFableFromPack,
  canUseFableOnPouch,
  canUseUnheldFable,
  fableTargetsTiles,
  isBlindOnlyConsumable,
  isFableId,
  useFable,
  useFableOnPouch,
} from '../engine/fables';
import {
  canUseGambler,
  canUseUnheldGambler,
  GAMBLER_REGISTRY,
  gamblerTargetsTiles,
  isGamblerId,
  useGambler,
  type GamblerId,
} from '../engine/gamblers';
import { packFableFxBus } from './packFableFx';
import { consumableEffectBus, shopUseNowMoneyDeltas } from './consumableEffect';
import { jokerChanceEffectBus } from './jokerChanceEffect';
import {
  bossRerollLimit,
  bossRerollPrice,
  canOwnConsumable,
  canOwnJoker,
  CONSUMABLE_PATTERN,
  interestCap,
  VOUCHER_REGISTRY,
} from '../engine/vouchers';
import {
  ALL_JOKERS,
  onBlindEndedWithDestroyedJokers,
  onConstellationUsed,
} from '../engine/jokers';
import {
  consumeNextBlindBonus,
  rollSkipOffers,
  skipCurrentBlind,
} from '../engine/skipRewards';
import { GROWTH_POP_MS } from './timing';
import { newRunObservationId } from './runObservation';
import {
  acknowledgeUnlockLedger,
  absorbPaletteUnlockBaseline,
  captureUnlockSnapshot,
  createUnlockLedger,
  finalizeUnlockLedger,
  normalizeUnlockLedger,
  resetUnlockRecapTerminal,
} from './unlockRecap';

/** Snapshot of the losing blind, for the Game Over screen (spec §2.7). */
export interface GameOverInfo {
  finalScore: number;
  target: number;
  ante: number;
  blindKind: BlindKind;
  bossId: string | null;
  /** true when the run ended by clearing the final chapter's Deadline (a win) */
  won: boolean;
  /** true for a post-victory loss or the explicit Chapter-38 endpoint. */
  endlessRun: boolean;
  /** true when the Chapter-38 Deadline itself was cleared. */
  endlessComplete: boolean;
}

/**
 * Per-run display stats (spec §2.7 Game Over). Pure observation of player
 * actions — no game rules — so the engine stays headless. Reset each run.
 */
export interface RunStats {
  wordsPlayed: number;
  tilesDiscarded: number;
  itemsBought: number;
  rerollsUsed: number;
  bestWord: { text: string; score: number } | null;
  patternCounts: Partial<Record<PatternId, number>>;
  jokerBlindCounts: Partial<Record<string, number>>;
  /** words collected for the first time ever, during this run */
  discoveries: number;
}

const freshStats = (): RunStats => ({
  wordsPlayed: 0,
  tilesDiscarded: 0,
  itemsBought: 0,
  rerollsUsed: 0,
  bestWord: null,
  patternCounts: {},
  jokerBlindCounts: {},
  discoveries: 0,
});

const productionJokerIds = new Set(ALL_JOKERS.map((joker) => joker.id));

const keepSelectedInHand = (selected: readonly string[], blind: BlindState): string[] => {
  const kept = selected.filter((id) => blind.hand.some((tile) => tile.id === id));
  return blind.forcedTileId && !kept.includes(blind.forcedTileId)
    ? [blind.forcedTileId, ...kept]
    : kept;
};

const withDestroyedJokers = (
  run: RunState,
  destroyed: readonly DestroyedJokerSnapshot[],
): RunState => {
  if (destroyed.length === 0) return run;
  const jokers = run.jokers.slice();
  for (const { joker, index } of [...destroyed].sort((a, b) => a.index - b.index)) {
    jokers.splice(Math.min(index, jokers.length), 0, joker);
  }
  return { ...run, jokers };
};

const withoutDestroyedJokers = (run: RunState): RunState => {
  const jokers = run.jokers.filter((joker) => joker.state.destroyed !== 1);
  return jokers.length === run.jokers.length ? run : { ...run, jokers };
};

/** Persisted pouch deltas only: previews, failed rolls, and temporary hand moves
 * never count as creation/destruction achievements. */
const recordPouchUnlockChanges = (before: RunState, after: RunState): void => {
  const beforeIds = new Set(before.bag.map((tile) => tile.id));
  const afterIds = new Set(after.bag.map((tile) => tile.id));
  const destroyed = before.bag.filter((tile) => !afterIds.has(tile.id));
  const created = after.bag.filter((tile) => !beforeIds.has(tile.id));
  if (destroyed.length > 0 || created.length > 0) {
    recordEmojiUnlockEvent({ kind: 'tileChanges', run: after, destroyed, created });
  }
};

/** Presentation payload for Emoji Tiles that resolved when Blind Select was confirmed. */
export interface BlindEntryEffectEvent {
  triggers: Array<{
    jokerId: string;
    jokerIndex: number;
    createdTiles: Tile[];
  }>;
}

export interface GameState {
  /** Persisted UI observation identity; never participates in engine RNG. */
  observationId: string;
  seed: string;
  rngCounter: number;
  run: RunState;
  blind: BlindState;
  selected: string[];
  phase: Phase;
  message: MessageSpec | null;
  /** the most recent submission's settle log + a counter to retrigger replay */
  lastEvents: ScoreEvent[];
  /** Transient Unopened Letter discard pull, rendered by StagePanel. */
  bossDiscard: { id: number; tiles: Tile[] } | null;
  /** One-shot Blind Select Emoji Tile trigger choreography. */
  blindEntryEffects: BlindEntryEffectEvent | null;
  settleId: number;
  /** committed score BEFORE the in-flight settle — lets the round number climb
   *  from the old committed to the new one during the animation (playtest-04 A-1) */
  committedBefore: number;
  /** last played word (for collection tracking); null on a fresh blind */
  lastPlayed: { text: string; isGibberish: boolean; score: number } | null;
  /** Magnifier result: up to 3 spellable words to highlight, or null */
  hint: HintWord[] | null;
  /** shop stock while phase === 'shop', else null */
  shop: ShopState | null;
  /** Shop Tags consumed by the latest stock roll; presentation clears them after the burst. */
  shopTagRedemptions: SkipRewardId[];
  /** an open pack awaiting selection, else null */
  pack: { offer: PackOffer; picksLeft: number; candidateTiles: Tile[] } | null;
  /** A free skip-tag pack must finish before the next blind is drawn. */
  pendingBlindAfterPack: boolean;
  /** blind settlement line items while phase === 'cashout', else null */
  cashout: BlindEarnings | null;
  /** the advanced run (gold + next chapter/blind) to apply when Fee Settlement is
   *  confirmed — kept pending so the board stays frozen on the cleared blind (A-2) */
  pendingRun: RunState | null;
  /** losing-blind snapshot while phase === 'gameover', else null */
  gameover: GameOverInfo | null;
  /** per-run display stats (Game Over screen) */
  stats: RunStats;
  /** Highest finalized blind score after choosing Endless Mode. */
  endlessBestScore: number;
  /**
   * The blind's last phase was just played and its settle is still animating
   * (A-4). The board stays visible; finalize (→ cash out or game over) runs once
   * the settle-complete signal fires and the verdict beat elapses.
   */
  pendingEnd: boolean;
  /**
   * The in-flight settle timeline has finished animating (SettleProvider's
   * completion signal). The round-clear / game-over UI is gated on THIS, never on
   * the raw final-score value (playtest-05 A; recurrence of 04 A-1). Reset to
   * false when a new settle starts; idle blinds sit at true.
   */
  settleComplete: boolean;
  /**
   * The blind's finalized score ((committed + sentence Chips) × sentence Mult), set once the
   * last settle lands. Non-null means the SENTENCE BONUS IS LANDING on the round
   * number right now (playtest-06 item 1): the bonus is only finalized at blind
   * end (GDD §7.1), so without this beat the clear screen arrived while the round
   * number still showed committed-only and the player never saw *why* it cleared.
   * Null at every other time — the bonus stays a separate forecast during play.
   */
  finalScore: number | null;
  /** Finalized sentence provenance from BUILD through live Fee Settlement.
   *  Collect clears it in the same transition that opens Shop. */
  sentenceBonus: SentenceBonusDisplay | null;
  /**
   * The player actually started this run (vs. the idle run `bootstrap` always
   * builds so the board has something to render). Gates the New Run screen's
   * Continue tab, and lives in state — rather than in App — so it persists with
   * the save and survives a reload.
   */
  runStarted: boolean;
  /**
   * This run started as the guided lesson: the opening hand was rigged to YELLOW and the
   * intro should hard-lock the first blind. Decided ONCE at bootstrap (same gate as the
   * rig) so it stays tied to the rigged blind. No later profile/internal flag change can
   * attach the hard-lock to a non-rigged blind, and the player has no replay control.
   */
  showIntro: boolean;
  /** feedback #2: chromatic-unlock ids earned THIS run (RED, MUSIC, ALIEN, …). Game
   *  Over announces them via the mascot and shows a card for each. Reset per run. */
  runUnlocks: string[];
}

export interface SentenceBonusDisplay extends SentenceBonusBreakdown {
  /** Sentence Chips added to the committed blind score. */
  chips: number;
  /** Sentence Mult applied after that Chips addition. */
  mult: number;
  pattern: PatternId | null;
  level: number | null;
}

const randomSeed = (): string => Math.random().toString(36).slice(2);

/**
 * How long the sentence bonus takes to count up onto the round number at blind
 * end (playtest-06 item 1). Exported so the Sidebar animates over the exact same
 * window the finalize timer waits for — one source of truth.
 */
export const BONUS_LAND_MS = 700;

// Beat held AFTER the round number finishes updating (settle beats, then the sentence
// bonus landing) before the blind auto-resolves to Fee Settlement / Game Over — so the
// cleared score is seen at its true final value before the modal opens (item 4 removed
// the intermediate Settle-button screen; this is the pacing beat that replaced it).
const VERDICT_BEAT_MS = 500;
const VERDICT_BEAT_REDUCED_MS = 200;

/** The open-pack slice of GameState. */
type OpenPack = NonNullable<GameState['pack']>;

/**
 * Take one option out of an open pack: drop it, spend a pick, and close the pack
 * once nothing is left to take. Shared by every pack path (pick / Fable / Gambler
 * / Constellation) so "when does the pack close" is decided in one place.
 */
function consumePackOption(pack: OpenPack, optionIndex: number): OpenPack | null {
  const options = pack.offer.options.filter((_, index) => index !== optionIndex);
  const picksLeft = pack.picksLeft - 1;
  if (picksLeft <= 0 || options.length === 0) return null;
  return { ...pack, offer: { ...pack.offer, options }, picksLeft };
}

/**
 * A skip-tag pack is part of Blind Select, not a shop visit. When its last pick
 * lands (or the player closes it), build the next blind in the SAME state update
 * so no empty SHOP frame can render between the two panels.
 */
export function completePendingPackTransition(state: GameState): GameState {
  if (!state.pendingBlindAfterPack || state.pack) return state;
  const rng = makeRng(`${state.seed}#${state.rngCounter}`);
  const blind = startBlind(state.run, rng, { bossId: state.run.chapterBossId });
  return {
    ...state,
    phase: 'blindselect',
    blind,
    pendingBlindAfterPack: false,
    selected: [],
    hint: null,
    message: null,
    lastEvents: [],
    bossDiscard: null,
    blindEntryEffects: null,
    settleId: 0,
    committedBefore: 0,
    lastPlayed: null,
    pendingEnd: false,
    settleComplete: true,
    finalScore: null,
    sentenceBonus: null,
    rngCounter: state.rngCounter + 1,
  };
}

/**
 * Re-derive the pouch-candidate row from the run after a card edited tiles. A
 * destroyed candidate disappears; a patched one shows its new face. Matching by
 * id is what keeps the row honest — the card may have replaced the tile object.
 */
function syncCandidates(candidates: readonly Tile[], run: RunState): Tile[] {
  const byId = new Map(run.bag.map((tile) => [tile.id, tile]));
  return candidates
    .map((tile) => byId.get(tile.id))
    .filter((tile): tile is Tile => tile !== undefined);
}

/** Flyer/Wanted Poster progress reads the owned editioned-tile count (§9.4). */
function recordEditionedJokers(run: RunState): void {
  recordVoucherProgress({
    kind: 'editionedJokers',
    count: run.jokers.filter((joker) => (joker.edition ?? 'base') !== 'base').length,
  });
}

export interface RunStartOptions {
  seed?: string;
  pouchId: PouchId;
  recordId: RecordId;
  customSeed: boolean;
  challengeId?: ChallengeId | null;
}

function bootstrap(options: Partial<RunStartOptions> = {}): GameState {
  const seed = options.seed?.trim() || randomSeed();
  // runs start empty — jokers/consumables are acquired in the shop (was: 3 demo jokers + a magnifier)
  const base: RunState = newRun(seed, {
    pouchId: options.pouchId ?? 'yellow',
    recordId: options.recordId ?? 'whiteLp',
    customSeed: options.customSeed ?? false,
    challengeId: options.challengeId ?? null,
  });
  // Chapter 1's voucher offer + Deadline boss (fixed per chapter; playtest-03 C, 04 D-6).
  const bossDraw = drawBossFromCycle(makeRng(`${seed}#boss-1`), bossPoolForAnte(1));
  const run: RunState = {
    ...base,
    voucherOffer: rollVoucherOffer(base, makeRng(`${seed}#voucher-1`), unlockedVoucherSet()),
    chapterBossId: bossDraw.bossId,
    bossHistory: bossDraw.history,
  };
  // First-run lesson (2026-07-21): rig the opening hand to contain YELLOW so the guided
  // steps can teach build → submit. The target is NOT lowered — it stays the normal ante-1
  // value, so after submitting YELLOW the lesson ends and the player plays on to clear. Same
  // gate as the guided intro (RunView), so a player who has done the tutorial (or turned tips
  // off) gets a normal random hand.
  const tutorial = !hasSeenIntro() && readTips();
  const blind = startBlind(run, makeRng(`${seed}#0`), {
    bossId: run.chapterBossId,
    ...(tutorial ? { openingLetters: TUTORIAL_WORD.split('') as Letter[] } : {}),
  });
  return {
    observationId: newRunObservationId(),
    seed,
    rngCounter: 1,
    run,
    blind,
    selected: [],
    phase: 'blindselect',
    message: null,
    lastEvents: [],
    bossDiscard: null,
    blindEntryEffects: null,
    settleId: 0,
    committedBefore: 0,
    lastPlayed: null,
    hint: null,
    shop: null,
    shopTagRedemptions: [],
    pack: null,
    pendingBlindAfterPack: false,
    cashout: null,
    pendingRun: null,
    gameover: null,
    stats: freshStats(),
    endlessBestScore: 0,
    pendingEnd: false,
    settleComplete: true,
    finalScore: null,
    sentenceBonus: null,
    runStarted: false,
    showIntro: tutorial,
    runUnlocks: createUnlockLedger(),
  };
}

export interface UseGame {
  state: GameState;
  getLexicon: () => Lexicon;
  canPlay: boolean;
  canDiscard: boolean;
  toggleTile: (id: string) => void;
  reorderHand: (orderedIds: string[]) => void;
  reorderJokers: (from: number, to: number) => void;
  reorderStaged: (fromId: string, beforeId: string | null) => void;
  useConsumable: (id: import('../engine/types').ConsumableId) => void;
  /** feedback #3: buy a shop consumable and use it in one action. */
  buyAndUse: (index: number) => void;
  canUseConsumable: (id: import('../engine/types').ConsumableId) => boolean;
  canMagnify: boolean;
  sellConsumable: (index: number) => void;
  buy: (index: number) => void;
  sell: (index: number) => void;
  reroll: () => void;
  leaveShop: () => void;
  clearShopTagRedemptions: () => void;
  buyVoucher: (slot?: 'base' | 'bonus') => void;
  rerollBoss: () => void;
  buyPack: (index: number) => void;
  pickPackOption: (index: number) => void;
  /** Resolve a selected Fable inside its pack, or hold it when blind-only. */
  usePackFable: (index: number, tileIds: string[]) => void;
  /** Resolve a Gambler card inside its pack against the pouch candidates (§10.3). */
  usePackGambler: (index: number, tileIds: string[]) => void;
  /** Use a Constellation directly from its pack, without occupying a slot. */
  usePackConstellation: (index: number) => void;
  /** Use an owned tile-targeting Fable on open Fable/Ink pack candidates. */
  useHeldPackFable: (id: import('../engine/fables').FableId, tileIds: string[]) => void;
  /** Use an owned Gambler against an open Fable/Ink pack's pouch candidates. */
  useHeldPackGambler: (id: GamblerId, tileIds: string[]) => void;
  closePack: (delayMs?: number) => void;
  playWord: (heldOrder?: string[]) => void;
  discard: (ids: string[]) => void;
  selectBlind: () => void;
  clearBlindEntryEffects: (event: BlindEntryEffectEvent) => void;
  skipBlind: () => void;
  confirmCashout: () => void;
  /** SettleProvider's completion signal — the settle timeline has finished (05 A). */
  markSettleComplete: () => void;
  continueEndless: () => void;
  acknowledgeUnlocks: () => void;
  /** Fold Settings-granted presentation ids into this run's recap baseline. */
  absorbPaletteUnlocks: (ids: readonly string[]) => void;
  endRun: () => void;
  newGame: () => void;
  /** Start a fresh run with the New Run screen's pouch, record, and seed choices. */
  startRun: (options: RunStartOptions) => void;
}

interface HeldPackCloseTransaction {
  timer: ReturnType<typeof setTimeout> | null;
}

export function useGame(getLexicon: () => Lexicon, lexiconReady: boolean): UseGame {
  // Resume a saved run if there is one; otherwise the idle bootstrap run.
  const [state, setState] = useState<GameState>(() => {
    const initial = completePendingPackTransition(loadRun() ?? bootstrap());
    return {
      ...initial,
      runUnlocks: normalizeUnlockLedger(initial.runUnlocks ?? [], captureUnlockSnapshot()),
    };
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const resumed = stateRef.current;
    if (resumed.runStarted) {
      recordVoucherProgress({ kind: 'resumeRun', customSeed: resumed.run.customSeed });
    }
  }, []);
  const heldPackConsumablePending = useRef(false);
  const heldPackConsumableCancel = useRef<(() => void) | null>(null);
  const heldPackCloseTransaction = useRef<HeldPackCloseTransaction | null>(null);

  const cancelHeldPackClose = useCallback((
    transaction = heldPackCloseTransaction.current,
  ) => {
    if (!transaction || heldPackCloseTransaction.current !== transaction) return;
    heldPackCloseTransaction.current = null;
    if (transaction.timer !== null) {
      clearTimeout(transaction.timer);
      transaction.timer = null;
    }
  }, []);
  const cancelPackTransactions = useCallback(() => {
    heldPackConsumableCancel.current?.();
    cancelHeldPackClose();
  }, [cancelHeldPackClose]);
  useEffect(() => () => cancelPackTransactions(), [cancelPackTransactions]);

  // Persist the run so it survives a reload (the Continue tab resumes it).
  // Dedupe on the serialized bytes: most state churn (staging a tile, hovering)
  // strips to an identical resting snapshot, and localStorage writes are
  // synchronous — we don't want one on every click.
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (!state.runStarted) return;
    const json = serializeRun(state);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    writeRun(json);
  }, [state]);

  // Blind-end decreases have no score timeline. Keep a terminal owner visible
  // for the direct popup beat, then remove it; score-timeline deaths are removed
  // synchronously by markSettleComplete below.
  useEffect(() => {
    if (!state.settleComplete || !state.run.jokers.some((joker) => joker.state.destroyed === 1)) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (!prev.settleComplete) return prev;
        const run = withoutDestroyedJokers(prev.run);
        return run === prev.run ? prev : { ...prev, run };
      });
    }, GROWTH_POP_MS);
    return () => clearTimeout(timer);
  }, [state.run.jokers, state.settleComplete]);

  // Recover stale live stock if an in-shop pack/effect acquires the same object.
  // New packs exclude these ids up front; this keeps old saves and indirect grants
  // from leaving an enabled-looking offer that the acquisition gate must reject.
  useEffect(() => {
    if (state.phase !== 'shop' || !state.shop) return;
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      let changed = false;
      const items = prev.shop.items.map((item) => {
        if (!item || item.kind === 'tile') return item;
        const available = item.kind === 'joker'
          ? canOwnJoker(prev.run, item.id) && shopEmojiSet().has(item.id)
          : canOwnConsumable(prev.run, item.id);
        if (available) return item;
        changed = true;
        return null;
      });
      return changed ? { ...prev, shop: { ...prev.shop, items } } : prev;
    });
  }, [state.phase, state.run.jokers, state.run.consumables, state.shop]);

  // Record each finished run into the lifetime stats exactly once (spec §2.12).
  // Keyed on the gameover snapshot identity so StrictMode re-runs don't double-count.
  const recordedGameOver = useRef<GameOverInfo | null>(null);
  useEffect(() => {
    const go = state.gameover;
    if (go && recordedGameOver.current !== go) {
      recordedGameOver.current = go;
      if (go.endlessRun && !go.won) {
        recordEndlessEnd({
          observationId: state.observationId,
          ante: go.ante,
          bestScore: state.endlessBestScore,
          patternCounts: state.stats.patternCounts,
        });
      } else {
        recordRunEnd({
          observationId: state.observationId,
          ante: go.ante,
          gold: state.run.gold,
          bestWord: state.stats.bestWord,
          won: go.won,
          pouchId: state.run.pouchId,
          recordId: state.run.recordId,
          customSeed: state.run.customSeed,
          challengeId: state.run.challengeId ?? null,
          jokerIds: state.run.jokers
            .filter((joker) => joker.state.destroyed !== 1)
            .map((joker) => joker.defId),
          patternCounts: state.stats.patternCounts,
        });
      }
      // recordRunEnd writes synchronously. Freeze the post-write delta into state so
      // GameOver rerenders with an exact, reload-safe recap payload.
      setState((prev) => {
        if (prev.gameover !== go) return prev;
        const runUnlocks = finalizeUnlockLedger(
          prev.runUnlocks,
          prev.run,
          captureUnlockSnapshot(),
        );
        return runUnlocks.join('\n') === prev.runUnlocks.join('\n')
          ? prev
          : { ...prev, runUnlocks };
      });
    }
  }, [
    state.gameover,
    state.observationId,
    state.run.gold,
    state.run.pouchId,
    state.run.recordId,
    state.run.customSeed,
    state.run.challengeId,
    state.run.jokers,
    state.stats.bestWord,
    state.stats.patternCounts,
    state.endlessBestScore,
  ]);

  // Persist cumulative settled-blind totals. Lifetime's durable observation baseline
  // absorbs StrictMode, reload, and write-order retries.
  useEffect(() => {
    if (!state.runStarted) return;
    recordJokerBlindCounts(state.observationId, state.stats.jokerBlindCounts);
  }, [state.observationId, state.runStarted, state.stats.jokerBlindCounts]);

  // Word collection (P2-2): record each non-gibberish play once it settles.
  // A globally-new word also bumps this run's discovery count (Game Over §2.7).
  useEffect(() => {
    const lp = state.lastPlayed;
    if (lp && !lp.isGibberish && recordWord(lp.text)) {
      setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, discoveries: prev.stats.discoveries + 1 },
      }));
    }
    // keyed on the submission counter — records exactly once per play
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settleId]);

  /** Judge & resolve the current blind, then route to Cash Out or Game Over. */
  const finalize = useCallback(
    (s: GameState): GameState => {
      const settledScore = s.finalScore;
      if (settledScore === null) return s;
      const final = endBlind(s.blind, s.run, getLexicon());
      const runWithMaterialGold: RunState = {
        ...s.run,
        gold: s.run.gold + final.materialGold,
      };
      const p = final.judgment.match?.pattern;
      const runWithPattern: RunState = p
        ? {
            ...runWithMaterialGold,
            patternPlayCounts: {
              ...runWithMaterialGold.patternPlayCounts,
              [p]: (runWithMaterialGold.patternPlayCounts[p] ?? 0) + 1,
            },
          }
        : runWithMaterialGold;
      const chanceResults: ChanceResult[] = [];
      const blindEndJokers = onBlindEndedWithDestroyedJokers(
        runWithPattern,
        s.blind,
        makeRng(`${s.seed}#joker-end-${s.run.ante}-${s.run.blindIndex}`),
        chanceResults,
      );
      const runAfterJokers = blindEndJokers.run;
      const visibleRunAfterJokers = withDestroyedJokers(
        runAfterJokers,
        blindEndJokers.destroyedJokers,
      );
      jokerChanceEffectBus.emit(chanceResults);
      recordPouchUnlockChanges(runWithPattern, runAfterJokers);
      const discoveredHands = loadDiscoveredLetterHands();
      const eligibleRandomHands = LETTER_HAND_REGISTRY
        .filter((hand) => isLetterHandDiscovered(hand.id, discoveredHands))
        .map((hand) => hand.id);
      const outcome = resolveBlind(
        runAfterJokers,
        s.blind,
        settledScore,
        eligibleRandomHands,
      );
      // Tally the finalized sentence pattern for "most played pattern" (§2.7).
      const patternCounts = { ...s.stats.patternCounts };
      if (p) patternCounts[p] = (patternCounts[p] ?? 0) + 1;
      const jokerBlindCounts = { ...s.stats.jokerBlindCounts };
      for (const id of new Set(runWithPattern.jokers
        .filter((joker) => joker.state.destroyed !== 1 && productionJokerIds.has(joker.defId))
        .map((joker) => joker.defId))) {
        jokerBlindCounts[id] = (jokerBlindCounts[id] ?? 0) + 1;
      }
      const stats: RunStats = { ...s.stats, patternCounts, jokerBlindCounts };
      const roundedFinal = Math.round(settledScore);
      recordBestRoundScore(roundedFinal);
      const endlessBestScore = s.run.victorySecured
        ? Math.max(s.endlessBestScore, roundedFinal)
        : s.endlessBestScore;

      if (!outcome.cleared) {
        recordEmojiUnlockEvent({ kind: 'snapshot', run: outcome.run });
        return {
          ...s,
          run: withDestroyedJokers(outcome.run, blindEndJokers.destroyedJokers),
          stats,
          endlessBestScore,
          phase: 'gameover',
          gameover: {
            finalScore: roundedFinal,
            target: s.blind.target,
            ante: outcome.run.ante,
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: false,
            endlessRun: s.run.victorySecured,
            endlessComplete: false,
          },
        };
      }
      recordVoucherProgress({
        kind: 'blindCleared',
        ante: s.run.ante,
        bossId: s.blind.bossId,
        interest: outcome.earned.interest,
        interestCap: interestCap(runWithPattern),
        handSize: s.blind.hand.length,
      });
      const acrostic = s.blind.sequence.length > 0 &&
        s.blind.sequence.every((word) => !word.isGibberish && word.text.length > 0) &&
        getLexicon().isWord(s.blind.sequence.map((word) => word.text[0]!).join(''));
      recordEmojiUnlockEvent({
        kind: 'blindCleared',
        run: runAfterJokers,
        blind: s.blind,
        judgment: final.judgment,
        interest: outcome.earned.interest,
        acrostic,
      });
      recordEmojiUnlockEvent({ kind: 'snapshot', run: outcome.run });
      if (outcome.won) recordVoucherProgress({ kind: 'runWon' });

      if (outcome.endlessComplete) {
        return {
          ...s,
          run: withDestroyedJokers(outcome.run, blindEndJokers.destroyedJokers),
          stats,
          endlessBestScore,
          phase: 'gameover',
          gameover: {
            finalScore: roundedFinal,
            target: s.blind.target,
            ante: s.run.ante,
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: false,
            endlessRun: true,
            endlessComplete: true,
          },
        };
      }
      // Cleared → the Fee Settlement screen, then the shop (GDD §9.1). Shop stock
      // rolls now so its seed position is stable across the settle → shop step.
      // "Early end" (playtest-03 B) = cleared with ≥1 phase remaining; bump the
      // counter (read by Loan Shark #28 when it ships).
      const phasesLeft = s.blind.phasesTotal - s.blind.phasesUsed;
      let advancedRun =
        phasesLeft > 0
          ? {
              ...outcome.run,
              counters: { ...outcome.run.counters, earlyEnds: outcome.run.counters.earlyEnds + 1 },
            }
          : outcome.run;
      // Clearing the Deadline (boss) restocks the voucher for the next chapter
      // and unlocks the one-purchase-per-chapter slot (playtest-03 C).
      if (runWithMaterialGold.blindIndex === 2) {
        const previousVoucherOffer = advancedRun.voucherOffer;
        const bossDraw = drawBossFromCycle(
          makeRng(`${s.seed}#boss-${advancedRun.ante}`),
          bossPoolForAnte(advancedRun.ante),
          advancedRun.bossHistory,
        );
        const chapterRun: RunState = {
          ...advancedRun,
          voucherOffer: rollVoucherOffer(
            advancedRun,
            makeRng(`${s.seed}#voucher-${advancedRun.ante}`),
            unlockedVoucherSet(),
            previousVoucherOffer ? new Set([previousVoucherOffer]) : new Set(),
          ),
          voucherLocked: false,
          voucherBasesBoughtThisChapter: [],
          bossRerollsUsed: 0,
          chapterBossId: bossDraw.bossId,
          bossHistory: bossDraw.history,
          wordsThisAnte: [], // new Chapter → boss word-history restrictions reset
          skippedThisChapter: [],
        };
        advancedRun = {
          ...chapterRun,
          skipOffers: rollSkipOffers(
            chapterRun,
            makeRng(`${s.seed}#skip-${chapterRun.ante}`),
            chapterRun.skipOffers,
          ),
        };
      }
      const rng = makeRng(`${s.seed}#${s.rngCounter}`);
      const preparedShop = prepareShop(
        advancedRun,
        rng,
        unlockedVoucherSet(),
        shopEmojiSet(),
        import.meta.env.DEV,
      );
      advancedRun = preparedShop.run;
      const shop = preparedShop.shop;
      if (outcome.won) {
        return {
          ...s,
          run: withDestroyedJokers({
            ...runAfterJokers,
            gold: outcome.run.gold,
            victorySecured: true,
          }, blindEndJokers.destroyedJokers),
          stats,
          phase: 'gameover',
          cashout: outcome.earned,
          pendingRun: advancedRun,
          shop,
          shopTagRedemptions: preparedShop.appliedTags,
          gameover: {
            finalScore: roundedFinal,
            target: s.blind.target,
            ante: s.run.ante,
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: true,
            endlessRun: false,
            endlessComplete: false,
          },
          selected: [],
          hint: null,
          message: null,
          rngCounter: s.rngCounter + 1,
        };
      }
      // Keep the cleared blind frozen behind Fee Settlement, while blind-end Emoji
      // state lands now so direct growth/decay tags remain visible (A-2).
      return {
        ...s,
        run: visibleRunAfterJokers,
        stats,
        endlessBestScore,
        phase: 'cashout',
        cashout: outcome.earned,
        pendingRun: advancedRun,
        shop,
        shopTagRedemptions: preparedShop.appliedTags,
        selected: [],
        hint: null,
        message: null,
        rngCounter: s.rngCounter + 1,
      };
    },
    [getLexicon],
  );

  const buy = useCallback((index: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const res = buyItem(prev.run, prev.shop, index, shopEmojiSet());
      if (!res.ok) return prev;
      const item = prev.shop.items[index]!;
      if (item.kind !== 'joker') {
        recordVoucherProgress({
          kind: 'shopBuy',
          item: item.kind === 'tile' ? 'tile' : item.kind === 'punctuation' ? 'constellation' : 'fable',
          spent: item.price,
        });
      } else recordVoucherProgress({ kind: 'shopBuy', item: 'other', spent: item.price });
      recordEmojiUnlockEvent({
        kind: item.kind === 'joker' ? 'jokerBought' : 'snapshot',
        run: res.run,
      });
      recordEditionedJokers(res.run);
      audio.play('purchase');
      return {
        ...prev,
        run: res.run,
        shop: res.shop,
        stats: { ...prev.stats, itemsBought: prev.stats.itemsBought + 1 },
      };
    });
  }, []);

  // Jokers can be sold from the shop AND mid-blind (item 1) — like consumables,
  // which sell in any phase. selling is phase-agnostic in the engine (sellJoker).
  const sell = useCallback((index: number) => {
    if (heldPackConsumablePending.current) return;
    setState((prev) => {
      if (prev.phase !== 'shop' && prev.phase !== 'playing') return prev;
      const res = sellJoker(prev.run, index, makeRng(`${prev.seed}#${prev.rngCounter}`));
      if (!res.ok) return prev;
      recordEmojiUnlockEvent({ kind: 'jokerSold', run: res.run });
      audio.play('sell');
      return {
        ...prev,
        run: res.run,
        shop: prev.shop ? repriceShop(res.run, prev.shop) : prev.shop,
        rngCounter: prev.rngCounter + 1,
      };
    });
  }, []);

  const reroll = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const res = rerollShop(
        prev.run,
        prev.shop,
        rng,
        unlockedVoucherSet(),
        shopEmojiSet(),
      );
      if (!res.ok) return prev;
      recordVoucherProgress({ kind: 'reroll', spent: currentRerollCost(prev.run, prev.shop) });
      recordEmojiUnlockEvent({ kind: 'snapshot', run: res.run });
      audio.play('reroll');
      return {
        ...prev,
        run: res.run,
        shop: res.shop,
        shopTagRedemptions: res.appliedTags ?? [],
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, rerollsUsed: prev.stats.rerollsUsed + 1 },
      };
    });
  }, []);

  const clearShopTagRedemptions = useCallback(() => {
    setState((prev) => prev.shopTagRedemptions.length === 0
      ? prev
      : { ...prev, shopTagRedemptions: [] });
  }, []);

  const leaveShop = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop') return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const blind = startBlind(prev.run, rng, { bossId: prev.run.chapterBossId });
      return {
        ...prev,
        phase: 'blindselect',
        blind,
        shop: null,
        shopTagRedemptions: [],
        selected: [],
        hint: null,
        message: null,
        // B-1: reset EVERY piece of per-blind UI state so the next blind's first
        // frame is clean (no stale tiles / settle / score remnants).
        lastEvents: [],
        bossDiscard: null,
        settleId: 0,
        committedBefore: 0,
        lastPlayed: null,
        pendingEnd: false,
        settleComplete: true,
        finalScore: null,
        sentenceBonus: null,
        rngCounter: prev.rngCounter + 1,
      };
    });
  }, []);

  /** Fee Settlement confirmed → apply the advanced run and open the shop. */
  const confirmCashout = useCallback(() => {
    setState((prev) =>
      prev.phase === 'cashout' && prev.pendingRun
        ? (() => {
          recordEmojiUnlockEvent({ kind: 'shopEntered', run: prev.pendingRun });
          return {
            ...prev,
            phase: 'shop',
            run: prev.pendingRun,
            pendingRun: null,
            cashout: null,
            // The persistent table keeps its sidebar mounted. Consume every
            // presentation-only remnant before the shop's first frame so the
            // previous settle cannot be replayed by that still-mounted subtree.
            lastEvents: [],
            bossDiscard: null,
            settleId: 0,
            committedBefore: 0,
            lastPlayed: null,
            pendingEnd: false,
            settleComplete: true,
            finalScore: null,
            sentenceBonus: null,
          };
        })()
        : prev,
    );
  }, []);

  /** Blind Select (§2.3) confirmed → begin the (already-drawn) blind. */
  const selectBlind = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'blindselect') return prev;
      const rng = makeRng(`${prev.seed}#blind-enter-${prev.run.ante}-${prev.rngCounter}`);
      const jokerEntered = enterJokerBlind(prev.run, prev.blind, rng);
      const entered = enterBossBlind(
        jokerEntered.run,
        jokerEntered.blind,
        makeRng(`${prev.seed}#boss-enter-${prev.run.ante}-${prev.rngCounter}`),
      );
      const run = consumeNextBlindBonus(entered.run);
      recordPouchUnlockChanges(prev.run, run);
      recordEmojiUnlockEvent({ kind: 'blindStarted', run });
      recordVoucherProgress({ kind: 'handSize', size: entered.blind.hand.length });
      recordVoucherProgress({ kind: 'anteReached', ante: prev.run.ante });
      if (prev.blind.bossId) recordVoucherProgress({ kind: 'bossSeen', id: prev.blind.bossId });
      const triggers = jokerEntered.triggers.map((trigger) => {
        const movedIndex = entered.run.jokers.indexOf(trigger.joker);
        return {
          jokerId: trigger.joker.defId,
          jokerIndex: movedIndex >= 0 ? movedIndex : trigger.jokerIndex,
          createdTiles: trigger.createdTiles,
        };
      });
      return {
        ...prev,
        phase: 'playing',
        run,
        blind: entered.blind,
        selected: entered.blind.forcedTileId ? [entered.blind.forcedTileId] : [],
        blindEntryEffects: triggers.length > 0 ? { triggers } : null,
      };
    });
  }, []);

  const clearBlindEntryEffects = useCallback((event: BlindEntryEffectEvent) => {
    setState((prev) => prev.blindEntryEffects === event
      ? { ...prev, blindEntryEffects: null }
      : prev);
  }, []);

  /** Skip Draft/Revision, grant its disclosed reward, and prepare the next blind. */
  const skipBlind = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'blindselect' || prev.run.blindIndex === 2) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const reward = skipCurrentBlind(
        prev.run,
        rng,
        { profileEligible: unlockedEmojiSet() },
      );
      const run = reward.run;
      const blind = reward.freePack
        ? prev.blind
        : startBlind(run, rng, { bossId: run.chapterBossId });
      const pack = reward.freePack
        ? (() => {
            const offer = rollPack(reward.freePack, run, rng, [], unlockedEmojiSet());
            return {
              offer,
              picksLeft: offer.pick,
              candidateTiles:
                reward.freePack.type === 'consumable' || reward.freePack.type === 'ink'
                  ? rng.shuffle(run.bag).slice(0, 10)
                  : [],
            };
          })()
        : null;
      recordEmojiUnlockEvent({ kind: 'blindSkipped', run });
      if (pack) recordEmojiUnlockEvent({ kind: 'packOpened', run });
      return {
        ...prev,
        run,
        blind,
        phase: pack ? 'shop' : 'blindselect',
        pack,
        pendingBlindAfterPack: pack !== null,
        selected: [],
        hint: null,
        message: null,
        shop: null,
        cashout: null,
        pendingRun: null,
        lastEvents: [],
        bossDiscard: null,
        settleId: 0,
        committedBefore: 0,
        lastPlayed: null,
        pendingEnd: false,
        settleComplete: true,
        finalScore: null,
        sentenceBonus: null,
        rngCounter: prev.rngCounter + 1,
        // The YELLOW lesson was rigged only for the skipped Draft. Keep it for
        // the next new run instead of hard-locking an ordinary Revision hand.
        showIntro: false,
      };
    });
  }, []);

  /** SettleProvider signals the settle timeline has landed — arms the clear UI (05 A). */
  const markSettleComplete = useCallback(() => {
    setState((prev) => {
      const run = withoutDestroyedJokers(prev.run);
      return prev.settleComplete && run === prev.run
        ? prev
        : { ...prev, run, settleComplete: true };
    });
  }, []);

  const continueEndless = useCallback(() => {
    setState((prev) =>
      prev.phase === 'gameover' &&
      prev.gameover?.won &&
      prev.cashout &&
      prev.pendingRun &&
      prev.shop
        ? {
            ...prev,
            phase: 'cashout',
            gameover: null,
            endlessBestScore: 0,
            runUnlocks: resetUnlockRecapTerminal(prev.runUnlocks),
          }
        : prev,
    );
  }, []);

  const acknowledgeUnlocks = useCallback(() => {
    const prev = stateRef.current;
    const runUnlocks = acknowledgeUnlockLedger(prev.runUnlocks);
    if (runUnlocks.join('\n') === prev.runUnlocks.join('\n')) return;
    const next = { ...prev, runUnlocks };
    // Confirmation must survive even an immediate reload; the regular save effect follows.
    writeRun(serializeRun(next));
    setState(next);
  }, []);

  const endRun = useCallback(() => {
    cancelPackTransactions();
    clearRun();
    setState((prev) => ({ ...prev, runStarted: false }));
  }, [cancelPackTransactions]);

  const buyVoucherAction = useCallback((slot: 'base' | 'bonus' = 'base') => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const boughtId = slot === 'bonus' ? prev.shop.bonusVoucher : prev.shop.voucher;
      const res = buyVoucher(prev.run, prev.shop, slot);
      if (!res.ok) return prev;
      if (boughtId) {
        recordVoucherProgress({
          kind: 'voucherBuy',
          id: boughtId,
          spent: VOUCHER_REGISTRY.get(boughtId)?.price ?? 0,
        });
      }
      recordEmojiUnlockEvent({ kind: 'snapshot', run: res.run });
      audio.play('voucherRedeem');
      tutorialBus.fire('firstVoucher');
      // Catalog upgrades open and fill their new sale slot immediately.
      let shop = res.shop;
      let rngCounter = prev.rngCounter;
      if (boughtId === 'catalog' || boughtId === 'couponBook') {
        const extra = rollExtraItem(
          res.run,
          res.shop.items,
          makeRng(`${prev.seed}#${rngCounter}`),
          unlockedEmojiSet(),
        );
        shop = { ...res.shop, items: [...res.shop.items, extra] };
        rngCounter += 1;
      }
      return {
        ...prev,
        run: res.run,
        shop,
        rngCounter,
        stats: { ...prev.stats, itemsBought: prev.stats.itemsBought + 1 },
      };
    });
  }, []);

  const buyPack = useCallback((index: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const slot = prev.shop.packs[index];
      if (!slot) return prev;
      const price = packBuyPrice(prev.run, slot);
      if (prev.run.gold < price) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const offer = rollPack(slot, prev.run, rng, prev.shop.items, unlockedEmojiSet());
      const packs = prev.shop.packs.slice();
      packs[index] = null;
      recordVoucherProgress({ kind: 'packBuy', spent: price });
      recordEmojiUnlockEvent({ kind: 'packOpened', run: prev.run });
      return {
        ...prev,
        run: { ...prev.run, gold: prev.run.gold - price },
        shop: { ...prev.shop, packs },
        pack: {
          offer,
          picksLeft: offer.pick,
          // Fable and Ink packs expose ten pouch tiles as the candidate field for
          // tile-targeting card effects. Other pack families need no candidates.
          candidateTiles:
            slot.type === 'consumable' || slot.type === 'ink'
              ? rng.shuffle(prev.run.bag).slice(0, 10)
              : [],
        },
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, itemsBought: prev.stats.itemsBought + 1 },
      };
    });
  }, []);

  const pickPackOption = useCallback((optionIndex: number) => {
    setState((prev) => {
      if (!prev.pack || prev.pack.picksLeft <= 0) return prev;
      const option = prev.pack.offer.options[optionIndex];
      if (!option) return prev;
      // Fables have their own confirm flow: immediate Use, except blind-only
      // cards which use Select and enter a held slot.
      if (option.kind === 'consumable' && isFableId(option.id)) return prev;
      // Gambler cards follow the same confirm-then-use flow (GDD §10.3).
      if (option.kind === 'consumable' && isGamblerId(option.id)) return prev;
      // Constellations are also confirmed through a dedicated immediate-use path;
      // they never enter the consumable shelf when opened from a pack.
      if (option.kind === 'punctuation') return prev;
      const run = applyPackPick(prev.run, option, unlockedEmojiSet());
      if (run === prev.run) return prev;
      // A-4 confirm SFX fires in PackOpening on selection (immediate feedback, feature-04
      // C) rather than here — blocked picks there never reach the pick action, so they
      // stay silent without a run-identity check.
      recordEditionedJokers(run);
      recordEmojiUnlockEvent({ kind: 'snapshot', run });
      return completePendingPackTransition({
        ...prev,
        run,
        pack: consumePackOption(prev.pack, optionIndex),
      });
    });
  }, []);

  const usePackFable = useCallback((optionIndex: number, tileIds: string[]) => {
    setState((prev) => {
      if (!prev.pack || prev.pack.picksLeft <= 0) return prev;
      const option = prev.pack.offer.options[optionIndex];
      if (!option || option.kind !== 'consumable' || !isFableId(option.id)) return prev;
      const id = option.id;

      const finish = (run: RunState, blind: BlindState, rngDelta: number): GameState => {
        const remaining = consumePackOption(prev.pack!, optionIndex);
        const pack = remaining
          ? { ...remaining, candidateTiles: syncCandidates(remaining.candidateTiles, run) }
          : null;
        return completePendingPackTransition({
          ...prev,
          run,
          blind,
          pack,
          rngCounter: prev.rngCounter + rngDelta,
          message: null,
        });
      };

      if (isBlindOnlyConsumable(id)) {
        if (!canUseFableFromPack(id, prev.run, prev.blind, [], unlockedEmojiSet())) return prev;
        const run = applyPackPick(prev.run, option, unlockedEmojiSet());
        if (run === prev.run) return prev;
        recordEmojiUnlockEvent({ kind: 'snapshot', run });
        return finish(run, prev.blind, 0);
      }

      if (!canUseFableFromPack(id, prev.run, prev.blind, tileIds, unlockedEmojiSet())) return prev;
      const stagedRun = { ...prev.run, consumables: [...prev.run.consumables, id] };
      let run: RunState;
      let blind = prev.blind;
      let chanceResults: ChanceResult[] = [];
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      if (fableTargetsTiles(id)) {
        const result = useFableOnPouch(id, stagedRun, tileIds, rng);
        if (!result.ok) return prev;
        run = result.run;
        chanceResults = result.chanceResults;
      } else {
        const result = useFable(
          id,
          stagedRun,
          prev.blind,
          [],
          rng,
          unlockedEmojiSet(),
        );
        if (!result.ok) return prev;
        run = result.run;
        blind = result.blind;
        chanceResults = result.chanceResults;
      }
      audio.play('consumableUse');
      recordVoucherProgress({ kind: 'consumableUsed', family: 'fable' });
      recordPouchUnlockChanges(prev.run, run);
      recordEmojiUnlockEvent({ kind: 'consumableUsed', run, family: 'fable' });
      recordEditionedJokers(run);
      consumableEffectBus.emit(id, prev.run, run, chanceResults);
      return finish(run, blind, 1);
    });
  }, []);

  /**
   * Resolve a Gambler card chosen inside an opened pack (GDD §10.3). The card is
   * staged into the run for one call so the ordinary preconditions stay the single
   * source of truth, then `useGambler` consumes it against the pack's seeded
   * pouch-candidate field — the same discipline tile-targeting Fables follow.
   */
  const usePackGambler = useCallback((optionIndex: number, tileIds: string[]) => {
    setState((prev) => {
      if (!prev.pack || prev.pack.picksLeft <= 0) return prev;
      const option = prev.pack.offer.options[optionIndex];
      if (!option || option.kind !== 'consumable' || !isGamblerId(option.id)) return prev;
      const id = option.id;
      const field = prev.pack.candidateTiles;
      const targets = gamblerTargetsTiles(id) ? tileIds : [];
      if (!canUseUnheldGambler(id, prev.run, field, targets, unlockedEmojiSet())) return prev;

      const stagedRun = { ...prev.run, consumables: [...prev.run.consumables, id] };
      const result = useGambler(
        id,
        stagedRun,
        prev.blind,
        field,
        targets,
        makeRng(`${prev.seed}#${prev.rngCounter}`),
        unlockedEmojiSet(),
      );
      if (!result.ok) return prev;

      // Destroyed/created tiles change the pouch; re-derive the candidate row from it
      // so the remaining picks target what actually exists.
      const remaining = consumePackOption(prev.pack, optionIndex);
      const pack = remaining
        ? { ...remaining, candidateTiles: syncCandidates(field, result.run) }
        : null;
      audio.play('consumableUse');
      recordVoucherProgress({ kind: 'consumableUsed', family: 'gambler' });
      recordPouchUnlockChanges(prev.run, result.run);
      recordEmojiUnlockEvent({ kind: 'consumableUsed', run: result.run, family: 'gambler' });
      recordEditionedJokers(result.run);
      if (GAMBLER_REGISTRY.get(id)?.effect.kind !== 'font') {
        consumableEffectBus.emit(id, prev.run, result.run);
      }
      return completePendingPackTransition({
        ...prev,
        run: result.run,
        blind: result.blind,
        pack,
        rngCounter: prev.rngCounter + 1,
        message: null,
      });
    });
  }, []);

  const usePackConstellation = useCallback((optionIndex: number) => {
    setState((prev) => {
      if (!prev.pack || prev.pack.picksLeft <= 0) return prev;
      const option = prev.pack.offer.options[optionIndex];
      if (!option || option.kind !== 'punctuation') return prev;
      const pattern = CONSUMABLE_PATTERN[option.id];
      if (!pattern) return prev;
      const from = prev.run.patternLevels[pattern] ?? 1;
      const pack = consumePackOption(prev.pack, optionIndex);
      const run = onConstellationUsed({
        ...prev.run,
        lastFableOrConstellation: option.id,
        patternLevels: {
          ...prev.run.patternLevels,
          [pattern]: from + 1,
        },
      });
      audio.play('consumableUse');
      recordVoucherProgress({ kind: 'consumableUsed', family: 'constellation' });
      recordEmojiUnlockEvent({ kind: 'consumableUsed', run, family: 'constellation' });
      patternLevelBus.emit({
        cardId: option.id as import('../engine/constellations').ConstellationId,
        pattern,
        from,
        to: from + 1,
      });
      return completePendingPackTransition({ ...prev, run, pack });
    });
  }, []);

  const useHeldPackFable = useCallback(
    (id: import('../engine/fables').FableId, tileIds: string[]) => {
      const current = stateRef.current;
      const candidateIds = new Set((current.pack?.candidateTiles ?? []).map((tile) => tile.id));
      if (
        heldPackConsumablePending.current ||
        heldPackCloseTransaction.current !== null ||
        current.phase !== 'shop' ||
        (current.pack?.offer.type !== 'consumable' && current.pack?.offer.type !== 'ink') ||
        !fableTargetsTiles(id) ||
        !tileIds.every((tileId) => candidateIds.has(tileId)) ||
        !canUseFableOnPouch(id, current.run, tileIds)
      ) {
        return;
      }
      const actionSeed = current.seed;
      const actionCounter = current.rngCounter;
      const rngKey = `${actionSeed}#${actionCounter}`;
      heldPackConsumablePending.current = true;
      let settled = false;
      const cancel = () => {
        if (settled) return;
        settled = true;
        if (heldPackConsumableCancel.current === cancel) {
          heldPackConsumableCancel.current = null;
          heldPackConsumablePending.current = false;
        }
      };
      heldPackConsumableCancel.current = cancel;
      const accepted = packFableFxBus.emit({
        id,
        tileIds: tileIds.slice(),
        rngKey,
        cancel,
        resolve: () => {
          if (settled) return;
          settled = true;
          if (heldPackConsumableCancel.current === cancel) {
            heldPackConsumableCancel.current = null;
            heldPackConsumablePending.current = false;
          }
          setState((prev) => {
            const activeCandidateIds = new Set(
              (prev.pack?.candidateTiles ?? []).map((tile) => tile.id),
            );
            if (
              prev.seed !== actionSeed ||
              prev.rngCounter !== actionCounter ||
              prev.phase !== 'shop' ||
              (prev.pack?.offer.type !== 'consumable' && prev.pack?.offer.type !== 'ink') ||
              !tileIds.every((tileId) => activeCandidateIds.has(tileId)) ||
              !canUseFableOnPouch(id, prev.run, tileIds)
            ) {
              return prev;
            }
            const result = useFableOnPouch(
              id,
              prev.run,
              tileIds,
              makeRng(rngKey),
            );
            if (!result.ok) return prev;
            const candidateTiles = syncCandidates(prev.pack.candidateTiles ?? [], result.run);
            consumableEffectBus.emit(id, prev.run, result.run, result.chanceResults);
            audio.play('consumableUse');
            recordVoucherProgress({ kind: 'consumableUsed', family: 'fable' });
            recordPouchUnlockChanges(prev.run, result.run);
            recordEmojiUnlockEvent({ kind: 'consumableUsed', run: result.run, family: 'fable' });
            return {
              ...prev,
              run: result.run,
              pack: { ...prev.pack, candidateTiles },
              message: null,
              rngCounter: prev.rngCounter + 1,
            };
          });
        },
      });
      if (!accepted) cancel();
    },
    [],
  );

  const useHeldPackGambler = useCallback((id: GamblerId, tileIds: string[]) => {
    const current = stateRef.current;
    const field = current.pack?.candidateTiles ?? [];
    const targets = gamblerTargetsTiles(id) ? tileIds : [];
    if (
      heldPackConsumablePending.current ||
      heldPackCloseTransaction.current !== null ||
      current.phase !== 'shop' ||
      (current.pack?.offer.type !== 'consumable' && current.pack?.offer.type !== 'ink') ||
      !canUseGambler(id, current.run, field, targets, unlockedEmojiSet())
    ) {
      return;
    }
    const actionSeed = current.seed;
    const actionCounter = current.rngCounter;
    const rngKey = `${actionSeed}#${actionCounter}`;
    heldPackConsumablePending.current = true;
    let settled = false;
    const cancel = () => {
      if (settled) return;
      settled = true;
      if (heldPackConsumableCancel.current === cancel) {
        heldPackConsumableCancel.current = null;
        heldPackConsumablePending.current = false;
      }
    };
    heldPackConsumableCancel.current = cancel;
    const accepted = packFableFxBus.emit({
      id,
      tileIds: targets.slice(),
      rngKey,
      cancel,
      resolve: () => {
        if (settled) return;
        settled = true;
        if (heldPackConsumableCancel.current === cancel) {
          heldPackConsumableCancel.current = null;
          heldPackConsumablePending.current = false;
        }
        setState((prev) => {
          if (
            prev.seed !== actionSeed ||
            prev.rngCounter !== actionCounter ||
            prev.phase !== 'shop' ||
            (prev.pack?.offer.type !== 'consumable' && prev.pack?.offer.type !== 'ink')
          ) {
            return prev;
          }
          const activeField = prev.pack.candidateTiles ?? [];
          const activeTargets = gamblerTargetsTiles(id) ? tileIds : [];
          if (!canUseGambler(
            id,
            prev.run,
            activeField,
            activeTargets,
            unlockedEmojiSet(),
          )) {
            return prev;
          }
          const result = useGambler(
            id,
            prev.run,
            prev.blind,
            activeField,
            activeTargets,
            makeRng(rngKey),
            unlockedEmojiSet(),
          );
          if (!result.ok) return prev;
          const candidateTiles = syncCandidates(activeField, result.run);
          audio.play('consumableUse');
          recordVoucherProgress({ kind: 'consumableUsed', family: 'gambler' });
          recordPouchUnlockChanges(prev.run, result.run);
          recordEmojiUnlockEvent({ kind: 'consumableUsed', run: result.run, family: 'gambler' });
          recordEditionedJokers(result.run);
          if (GAMBLER_REGISTRY.get(id)?.effect.kind !== 'font') {
            consumableEffectBus.emit(id, prev.run, result.run);
          }
          return {
            ...prev,
            run: result.run,
            blind: result.blind,
            pack: { ...prev.pack, candidateTiles },
            message: null,
            rngCounter: prev.rngCounter + 1,
          };
        });
      },
    });
    if (!accepted) cancel();
  }, []);

  const closePack = useCallback((delayMs = 0) => {
    if (heldPackCloseTransaction.current !== null) return;
    const transaction: HeldPackCloseTransaction = { timer: null };
    heldPackCloseTransaction.current = transaction;
    heldPackConsumableCancel.current?.();
    const commit = () => {
      if (heldPackCloseTransaction.current !== transaction) return;
      transaction.timer = null;
      heldPackCloseTransaction.current = null;
      setState((prev) => completePendingPackTransition({ ...prev, pack: null }));
    };
    if (delayMs > 0) {
      transaction.timer = setTimeout(commit, delayMs);
    } else {
      commit();
    }
  }, []);

  const toggleTile = useCallback((id: string) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.pendingEnd || !prev.settleComplete || !prev.blind.hand.some((t) => t.id === id))
        return prev;
      if (id === prev.blind.forcedTileId && prev.selected.includes(id)) return prev;
      const selected = prev.selected.includes(id)
        ? prev.selected.filter((x) => x !== id)
        : [...prev.selected, id];
      // E-4: keep the magnifier hint (and its tile highlights) visible while
      // staging — it only clears on Play or Discard.
      return { ...prev, selected };
    });
  }, []);

  const reorderHand = useCallback((orderedIds: string[]) => {
    setState((prev) => {
      if (prev.phase !== 'playing') return prev;
      const staged = new Set(prev.selected);
      const visible = prev.blind.hand.filter((tile) => !staged.has(tile.id));
      if (
        orderedIds.length !== visible.length ||
        orderedIds.some((id) => !visible.some((tile) => tile.id === id))
      ) return prev;
      const byId = new Map(prev.blind.hand.map((t) => [t.id, t]));
      let index = 0;
      const hand = prev.blind.hand.map((tile) =>
        staged.has(tile.id) ? tile : byId.get(orderedIds[index++]!)!,
      );
      return { ...prev, blind: { ...prev.blind, hand } };
    });
  }, []);

  const reorderStaged = useCallback((fromId: string, beforeId: string | null) => {
    setState((prev) =>
      prev.phase !== 'playing'
        ? prev
        : { ...prev, selected: reorderIds(prev.selected, fromId, beforeId) },
    );
  }, []);

  // D-1: drag-reorder the owned-joker shelf. Order IS hook-execution order
  // (loop.ts iterates run.jokers), so this is strategic (additive-before-
  // multiplicative). Persisted in run state; index-based since jokers can dup.
  const reorderJokers = useCallback((from: number, to: number) => {
    if (heldPackConsumablePending.current) return;
    setState((prev) => {
      const jokers = prev.run.jokers;
      if (from < 0 || to < 0 || from >= jokers.length || to >= jokers.length || from === to) {
        return prev;
      }
      const next = jokers.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      const run = { ...prev.run, jokers: next };
      return {
        ...prev,
        run,
        shop: prev.shop ? repriceShop(run, prev.shop) : prev.shop,
      };
    });
  }, []);

  // Apply a consumable to the current state. Pure state→state. A same-axis overwrite
  // just replaces the enhancement — no confirm modal (feedback: players learn by doing,
  // GDD §2.4 revised 2026-07-28).
  const applyConsumable = useCallback(
    (prev: GameState, id: ConsumableId, shopPrice?: number): GameState => {
      // Consumables are usable on the board AND in the shop (feedback #3), except
      // tile-targeting and blind-only Fables, which must be held for a blind.
      if ((prev.phase !== 'playing' && prev.phase !== 'shop') || !prev.run.consumables.includes(id)) {
        return prev;
      }
      if (prev.phase === 'shop' && (fableTargetsTiles(id) || isBlindOnlyConsumable(id))) return prev;
      // The shop has no active tile field. Only field-free Gambler effects whose
      // other preconditions pass may resolve there.
      if (prev.phase === 'shop' && isGamblerId(id) &&
          !canUseGambler(id, prev.run, [], [], unlockedEmojiSet())) return prev;
      if (isGamblerId(id)) {
        const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
        const result = useGambler(
          id,
          prev.run,
          prev.blind,
          prev.phase === 'shop' ? [] : prev.blind.hand,
          prev.selected,
          rng,
          unlockedEmojiSet(),
        );
        if (!result.ok) return { ...prev, message: { key: 'consumable.invalidSelection' } };
        const selected = prev.selected.filter((tileId) =>
          result.blind.hand.some((tile) => tile.id === tileId),
        );
        const blind = reconcileBossHand(result.run, result.blind, rng);
        audio.play('consumableUse');
        recordVoucherProgress({ kind: 'consumableUsed', family: 'gambler' });
        recordPouchUnlockChanges(prev.run, result.run);
        recordEmojiUnlockEvent({ kind: 'consumableUsed', run: result.run, family: 'gambler' });
        recordEditionedJokers(result.run);
        consumableEffectBus.emit(id, prev.run, result.run);
        return {
          ...prev,
          run: result.run,
          blind,
          selected: keepSelectedInHand(selected, blind),
          message: null,
          rngCounter: prev.rngCounter + 1,
        };
      }
      if (isFableId(id)) {
        const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
        const result = useFable(
          id,
          prev.run,
          prev.blind,
          prev.selected,
          rng,
          unlockedEmojiSet(),
        );
        if (!result.ok) return { ...prev, message: { key: 'consumable.invalidSelection' } };
        const blind = reconcileBossHand(result.run, result.blind, rng);
        audio.play('consumableUse'); // A-3: object actions are audible
        recordVoucherProgress({ kind: 'consumableUsed', family: 'fable' });
        recordPouchUnlockChanges(prev.run, result.run);
        recordEmojiUnlockEvent({ kind: 'consumableUsed', run: result.run, family: 'fable' });
        recordEditionedJokers(result.run);
        consumableEffectBus.emit(
          id,
          prev.run,
          result.run,
          result.chanceResults,
          shopPrice === undefined
            ? []
            : shopUseNowMoneyDeltas(id, shopPrice, prev.run, result.run),
        );
        const hint = result.requestHint
          ? findSpellableWords(blind.hand, getLexicon(), 3, { run: result.run, blind })
          : prev.hint;
        const next = {
          ...prev,
          run: result.run,
          blind,
          selected: prev.selected.filter((tileId) =>
            result.blind.hand.some((tile) => tile.id === tileId),
          ),
          hint,
          message: null,
          rngCounter: prev.rngCounter + 1,
        };
        return { ...next, selected: keepSelectedInHand(next.selected, blind) };
      }
      const idx = prev.run.consumables.indexOf(id);
      const consumables = prev.run.consumables.slice();
      consumables.splice(idx, 1);
      const pattern = CONSUMABLE_PATTERN[id];
      audio.play('consumableUse'); // A-3
      if (pattern) {
        recordVoucherProgress({ kind: 'consumableUsed', family: 'constellation' });
        const run = onConstellationUsed({
          ...prev.run,
          consumables,
          lastFableOrConstellation: id,
          patternLevels: {
            ...prev.run.patternLevels,
            [pattern]: (prev.run.patternLevels[pattern] ?? 1) + 1,
          },
        });
        recordEmojiUnlockEvent({ kind: 'consumableUsed', run, family: 'constellation' });
        return {
          ...prev,
          run,
        };
      }
      recordVoucherProgress({ kind: 'consumableUsed', family: 'fable' });
      const hint = id === 'magnifier'
        ? findSpellableWords(prev.blind.hand, getLexicon(), 3, { run: prev.run, blind: prev.blind })
        : prev.hint;
      const run = { ...prev.run, consumables };
      recordEmojiUnlockEvent({ kind: 'consumableUsed', run, family: 'fable' });
      consumableEffectBus.emit(id, prev.run, run);
      return { ...prev, run, hint };
    },
    [getLexicon],
  );

  const useConsumable = useCallback(
    (id: ConsumableId) => {
      if (heldPackConsumablePending.current) return;
      setState((prev) => {
        const pattern = CONSUMABLE_PATTERN[id];
        const from = pattern ? (prev.run.patternLevels[pattern] ?? 1) : 0;
        const next = applyConsumable(prev, id);
        // A tile-destroying consumable (fable18, Butterflies) can empty the hand with a
        // dry pouch — the same unplayable board playWord and discard already guard.
        // `phase === 'playing'` is load-bearing: applyConsumable also runs in the shop,
        // where prev.blind is a stale leftover that would read as exhausted.
        const stalled = next.phase === 'playing' && !next.pendingEnd && blindExhausted(next.blind);
        // feedback #6: a Constellation card just leveled its pattern → fire the flourish.
        if (pattern && next !== prev && next.run.patternLevels[pattern] !== prev.run.patternLevels[pattern]) {
          patternLevelBus.emit({
            cardId: id as import('../engine/constellations').ConstellationId,
            pattern,
            from,
            to: next.run.patternLevels[pattern] ?? from + 1,
          });
        }
        return stalled ? { ...next, pendingEnd: true } : next;
      });
    },
    [applyConsumable],
  );

  // feedback #3: "instant use" a shop consumable — buy AND use in one action, skipping
  // the consumable-slot cap (it never rests in a slot). Tile-targeting and blind-only
  // Fables are intentionally excluded: they may only be bought and held for a blind.
  const buyAndUse = useCallback((index: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const item = prev.shop.items[index];
      if (!item || (item.kind !== 'consumable' && item.kind !== 'punctuation')) return prev;
      if (prev.run.gold < item.price) return prev;
      const id = item.id;
      if (!canOwnConsumable(prev.run, id)) return prev;
      if (fableTargetsTiles(id) || isBlindOnlyConsumable(id)) return prev;
      if (isFableId(id) &&
          !canUseUnheldFable(id, prev.run, prev.blind, unlockedEmojiSet())) return prev;
      if (isGamblerId(id) &&
          !canUseUnheldGambler(id, prev.run, [], [], unlockedEmojiSet())) return prev;
      const items = prev.shop.items.slice();
      items[index] = null;
      const paid: GameState = {
        ...prev,
        run: { ...prev.run, gold: prev.run.gold - item.price, consumables: [...prev.run.consumables, id] },
        shop: { ...prev.shop, items },
        stats: { ...prev.stats, itemsBought: prev.stats.itemsBought + 1 },
      };
      audio.play('purchase');
      const pattern = CONSUMABLE_PATTERN[id];
      const from = pattern ? (paid.run.patternLevels[pattern] ?? 1) : 0;
      const next = applyConsumable(paid, id, item.price);
      if (pattern && next !== paid && next.run.patternLevels[pattern] !== paid.run.patternLevels[pattern]) {
        patternLevelBus.emit({
          cardId: id as import('../engine/constellations').ConstellationId,
          pattern,
          from,
          to: next.run.patternLevels[pattern] ?? from + 1,
        });
      }
      return next;
    });
  }, [applyConsumable]);

  const playWord = useCallback((heldOrder?: string[]) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || !prev.settleComplete || prev.selected.length === 0) return prev;
      if (prev.blind.phasesUsed >= prev.blind.phasesTotal) return prev;
      let result;
      try {
        result = submitWord(
          prev.blind,
          prev.run,
          getLexicon(),
          prev.selected,
          makeRng(`${prev.seed}#${prev.rngCounter}`),
          heldOrder,
        );
      } catch {
        // Boss legality (e.g. The Noun Lock) — surface, don't crash.
        return { ...prev, message: { key: 'boss.blocked' } };
      }
      const {
        events,
        submission,
        goldDelta,
        destroyedTileIds,
        createdTiles,
        updatedTiles,
        bossDiscardedTiles,
        jokers,
        destroyedJokers,
        counters,
        playedWords,
        discoveredPatterns,
        playedLetterHands,
        letterHandPlayCounts,
        lastLetterHand,
        discardedLetters,
        discardedLetterCounts,
      } = result;
      const selectedIds = new Set(prev.selected);
      const heldTiles = prev.blind.hand.filter((tile) => !selectedIds.has(tile.id));
      const updatedById = new Map(updatedTiles.map((tile) => [tile.id, tile]));
      const updateTile = (tile: import('../engine/types').Tile) =>
        updatedById.get(tile.id) ?? tile;
      const blind = {
        ...result.blind,
        hand: result.blind.hand.map(updateTile),
        bag: result.blind.bag.map(updateTile),
        discardedThisBlind: result.blind.discardedThisBlind.map(updateTile),
      };
      recordVoucherProgress({ kind: 'tilesPlayed', count: submission.tiles.length });
      if (submission.isGibberish) tutorialBus.fire('firstGibberish');
      // Chromatic unlocks (feature-02 C): a VALID word may write a presentation
      // layer into the world on its first-ever play. Gibberish never unlocks.
      let unlockedId: string | null = null;
      if (!submission.isGibberish) {
        const unlocked = checkWordPlayed(submission.text);
        if (unlocked) {
          unlockBus.emit(unlocked);
          unlockedId = unlocked.id; // feedback #2: remembered so Game Over can announce it
        }
      }
      // A-2: a per-word structure bonus (Twin/Vowel Flush/Straight…) landed —
      // explain Word Hands the first time one actually scores. The event is
      // only present when a hand triggered (loop.ts), so its presence is the signal.
      if (events.some((e) => e.kind === 'letterHand')) tutorialBus.fire('firstLetterHand');
      const nextRun = {
        ...prev.run,
        jokers,
        counters,
        playedWords,
        discoveredPatterns,
        playedLetterHands,
        letterHandPlayCounts,
        lastLetterHand,
        discardedLetters,
        discardedLetterCounts,
        gold: Math.max(0, prev.run.gold + goldDelta),
        bag: prev.run.bag
          .filter((t) => !destroyedTileIds.includes(t.id))
          .map(updateTile)
          .concat(createdTiles),
        // Track valid words this Chapter for Memoirs and Stereotype Plate;
        // gibberish is never tracked. Reset when the Chapter's Deadline clears.
        wordsThisAnte: submission.isGibberish
          ? prev.run.wordsThisAnte
          : [...prev.run.wordsThisAnte, submission.text.toLowerCase()],
      };
      const visibleNextRun = withDestroyedJokers(nextRun, destroyedJokers);
      recordPouchUnlockChanges(prev.run, nextRun);
      const letterHandId = events.find((event) => event.kind === 'letterHand')?.hand ?? null;
      if (letterHandId) discoverLetterHand(letterHandId);
      if (!submission.debuffed) {
        recordEmojiUnlockEvent({
          kind: 'wordPlayed',
          run: nextRun,
          blind,
          submission,
          letterHandId,
          heldTiles,
          bossDiscarded: bossDiscardedTiles.length,
        });
      }
      const wordScore = letterChips(submission.tiles);
      const best = prev.stats.bestWord;
      const bestWord =
        !submission.isGibberish && !submission.debuffed && (!best || wordScore > best.score)
          ? { text: submission.text, score: wordScore }
          : best;
      const next: GameState = {
        ...prev,
        run: visibleNextRun,
        blind,
        selected: keepSelectedInHand([], blind),
        message: submission.debuffed ? { key: 'boss.notAllowed' } : null,
        runUnlocks: unlockedId ? [...prev.runUnlocks, unlockedId] : prev.runUnlocks,
        lastEvents: events,
        bossDiscard: bossDiscardedTiles.length > 0
          ? { id: prev.settleId + 1, tiles: bossDiscardedTiles }
          : null,
        settleId: prev.settleId + 1,
        // A new settle starts; the completion signal re-arms (05 A) so the clear
        // UI waits for THIS word's settle to land, not the previous one's.
        settleComplete: false,
        finalScore: null,
        sentenceBonus: null,
        // committed BEFORE this word, so the round number climbs to the new
        // committed during the settle rather than snapping (A-1).
        committedBefore: prev.blind.committedScore,
        lastPlayed: {
          text: submission.text,
          isGibberish: submission.isGibberish,
          score: wordScore,
        },
        hint: null,
        stats: { ...prev.stats, wordsPlayed: prev.stats.wordsPlayed + 1, bestWord },
        rngCounter: prev.rngCounter + 1,
      };
      // Auto-settle (playtest-03 B): the blind ends the moment the projected
      // total ((committed + sentence Chips) × sentence Mult) reaches the target.
      // The Perfectionist disables it (settles only when phases run out). Either
      // way the board stays visible so the full settle + sentence-finalize plays
      // before Fee Settlement; a timer runs finalize.
      const phasesOut = blind.phasesUsed >= blind.phasesTotal;
      // No tiles left to play and none to draw — the board is unplayable, so it
      // resolves here instead of stalling. Below target this is a loss; the normal
      // finalize path decides, so the sentence bonus still gets its chance.
      const dryOut = blindExhausted(blind);
      const autoSettle = !blind.earlyEndDisabled && blind.projectedScore >= blind.target;
      return phasesOut || dryOut || autoSettle ? { ...next, pendingEnd: true } : next;
    });
  }, [getLexicon]);

  // Resolve the blind (→ Fee Settlement on a win, → Game Over on a loss) ONLY
  // after the settle-complete signal fires — never on the raw final score, which
  // is known instantly (playtest-05 A; recurrence of 04 A-1, unifying 04 A-2: the
  // deciding sentence bonus must be *seen* pushing the score over first). The
  // signal already tracks the variable settle length (long words settle longer).
  //
  // The bonus lands as a distinct climax in three beats (2026-07-22): BUILD fills
  // the scorebox to (committed + sentence Chips) × sentence Mult while the round HOLDS;
  // LAND then rolls the round up; RESOLVE holds a verdict beat and auto-resolves.
  // Both sources — the OS setting AND the in-game Options toggle. Reading only
  // the media query here is what let the blind-end bonus keep animating with
  // Reduced Motion on (2026-07-31 audit VFX-01 / I-2).
  const prefersReduce = motionOff;

  // BUILD — the last word's settle has landed. Publish the sentence bonus so the
  // scorebox fills to its combined Chips × Mult, but HOLD the round number at committed
  // (finalScore stays null → Sidebar's round target falls back to committedScore).
  // Reduced motion collapses build+land: set finalScore now too. A zero bonus
  // A zero bonus (no pattern or register bonus) skips the build — just set finalScore.
  useEffect(() => {
    if (!lexiconReady || !state.pendingEnd || !state.settleComplete) return;
    if (state.sentenceBonus !== null || state.finalScore !== null) return;
    const end = endBlind(state.blind, state.run, getLexicon());
    const pattern = end.judgment.match?.pattern ?? null;
    const level = pattern ? (state.run.patternLevels[pattern] ?? 1) : null;
    const hasBonus = end.bonus > 0;
    const reduce = prefersReduce();
    setState((prev) => {
      if (!prev.pendingEnd || prev.sentenceBonus !== null || prev.finalScore !== null) return prev;
      const sentenceBonus = hasBonus
        ? {
            chips: end.sentenceChips,
            mult: end.sentenceMult,
            pattern,
            level,
            ...end.breakdown,
          }
        : null;
      // Reduced motion OR no bonus → land immediately (finalScore set now).
      const finalScore = reduce || !hasBonus ? end.finalScore : null;
      return { ...prev, sentenceBonus, finalScore };
    });
  }, [lexiconReady, state.pendingEnd, state.settleComplete, state.sentenceBonus, state.finalScore, state.blind, state.run, getLexicon]);

  // LAND — after the box has filled (BONUS_LAND_MS), publish finalScore so the
  // round number rolls committed → finalized. Only runs for a real bonus in full
  // motion (build set sentenceBonus, left finalScore null).
  useEffect(() => {
    if (!lexiconReady || !state.pendingEnd || state.sentenceBonus === null || state.finalScore !== null) return;
    const end = endBlind(state.blind, state.run, getLexicon());
    const id = setTimeout(
      () =>
        setState((prev) =>
          prev.pendingEnd && prev.sentenceBonus !== null && prev.finalScore === null
            ? { ...prev, finalScore: end.finalScore }
            : prev,
        ),
      BONUS_LAND_MS,
    );
    return () => clearTimeout(id);
  }, [lexiconReady, state.pendingEnd, state.sentenceBonus, state.finalScore, state.blind, state.run, getLexicon]);

  // RESOLVE — the round number is fully updated (settle beats + bonus). Hold a short
  // beat so the cleared score is seen, then auto-resolve to Fee Settlement / Game Over
  // (item 4: the intermediate "Cleared! + Settle button" screen was removed — the Fee
  // Settlement modal, with its own Collect button, is the only clear screen now).
  useEffect(() => {
    if (!state.pendingEnd || state.finalScore === null) return;
    const reduce = prefersReduce();
    const id = setTimeout(
      () => setState((prev) => {
        if (!prev.pendingEnd || prev.finalScore === null) return prev;
        return { ...finalize(prev), pendingEnd: false };
      }),
      reduce ? VERDICT_BEAT_REDUCED_MS : BONUS_LAND_MS + VERDICT_BEAT_MS,
    );
    return () => clearTimeout(id);
  }, [state.pendingEnd, state.finalScore, finalize]);

  // C-3: discard acts on an explicit set of MARKED hand tiles, independent of
  // what is staged in the tile zone. Tiles exit for the blind (draw is RNG-free;
  // the rng is used only for discardGain font seal rolls, GDD §2.3).
  const discard = useCallback((ids: string[]) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.pendingEnd || !prev.settleComplete) return prev;
      if (prev.blind.discardsLeft <= 0) return prev;
      const staged = new Set(prev.selected);
      const valid = ids.filter((id) => !staged.has(id) && prev.blind.hand.some((t) => t.id === id));
      if (valid.length === 0) return prev; // no per-use tile cap (D-4)
      const {
        run: discardRun,
        blind,
        jokers,
        goldDelta,
        gained,
        slotsBlocked,
        discardedLetters,
        discardedLetterCounts,
        bag,
        destroyedTiles,
      } = discardTiles(
        prev.blind,
        prev.run,
        valid,
        makeRng(`${prev.seed}#${prev.rngCounter}`),
      );
      recordVoucherProgress({ kind: 'tilesDiscarded', count: valid.length });
      const nextRun: RunState = {
        ...discardRun,
        jokers,
        bag,
        discardedLetters,
        discardedLetterCounts,
        gold: prev.run.gold + goldDelta,
        consumables: gained.length
          ? [...prev.run.consumables, ...gained]
          : prev.run.consumables,
      };
      if (destroyedTiles.length > 0) {
        recordPouchUnlockChanges(prev.run, nextRun);
      }
      recordEmojiUnlockEvent({
        kind: 'discardUsed',
        run: nextRun,
        tiles: valid.length,
        slotsBlocked,
      });
      const nextState: GameState = {
        ...prev,
        blind,
        run: nextRun,
        message: slotsBlocked > 0 ? { key: 'font.slotsFull' } : null,
        hint: null,
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, tilesDiscarded: prev.stats.tilesDiscarded + valid.length },
      };
      // Discarding the last tiles with a dry pouch leaves an unplayable board — the
      // same resolution the play path takes. No new settle runs, so `settleComplete`
      // is already true and the BUILD effect picks it up on the next render.
      return blindExhausted(blind) ? { ...nextState, pendingEnd: true } : nextState;
    });
  }, []);

  /** Sell a held consumable for half its price (C-4 Use/Sell menu). */
  const sellConsumable = useCallback((index: number) => {
    if (heldPackConsumablePending.current) return;
    setState((prev) => {
      const c = prev.run.consumables[index];
      if (!c) return prev;
      const consumables = prev.run.consumables.slice();
      consumables.splice(index, 1);
      const gold = prev.run.gold + consumableSellValue(prev.run, c);
      const run = { ...prev.run, consumables, gold };
      recordEmojiUnlockEvent({ kind: 'snapshot', run });
      return { ...prev, run };
    });
  }, []);

  const rerollBoss = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'blindselect') return prev;
      if (prev.run.blindIndex !== 2) return prev;
      if (prev.run.gold < bossRerollPrice()) return prev;
      if (prev.run.bossRerollsUsed >= bossRerollLimit(prev.run)) return prev;
      const rng = makeRng(`${prev.seed}#boss-reroll-${prev.rngCounter}`);
      const pool = prev.run.chapterBossId
        ? bossPoolForId(prev.run.chapterBossId)
        : bossPoolForAnte(prev.run.ante);
      // Exclude the current boss from the pool rather than re-drawing on a
      // match: two draws could both land on it, and the player paid for a change.
      const bossDraw = drawBossFromCycle(
        rng,
        pool,
        prev.run.bossHistory,
        prev.run.chapterBossId,
      );
      const bossId = bossDraw.bossId;
      const run = {
        ...prev.run,
        gold: prev.run.gold - bossRerollPrice(),
        chapterBossId: bossId,
        bossHistory: bossDraw.history,
        bossRerollsUsed: prev.run.bossRerollsUsed + 1,
      };
      const blind = prev.run.blindIndex === 2
        ? startBlind(run, rng, { kind: 'boss', bossId })
        : prev.blind;
      audio.play('reroll');
      return { ...prev, run, blind, rngCounter: prev.rngCounter + 1 };
    });
  }, []);

  const newGame = useCallback(() => {
    cancelPackTransactions();
    const next = { ...bootstrap(), runStarted: true };
    recordVoucherProgress({
      kind: 'newRun', handSize: next.run.handSize, customSeed: next.run.customSeed,
    });
    recordEmojiUnlockEvent({ kind: 'newRun', run: next.run });
    setState(next);
  }, [cancelPackTransactions]);
  const startRun = useCallback((options: RunStartOptions) => {
    cancelPackTransactions();
    const next = { ...bootstrap(options), runStarted: true };
    recordVoucherProgress({
      kind: 'newRun', handSize: next.run.handSize, customSeed: next.run.customSeed,
    });
    recordEmojiUnlockEvent({ kind: 'newRun', run: next.run });
    setState(next);
  }, [cancelPackTransactions]);
  const absorbPaletteUnlocks = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    const prev = stateRef.current;
    const runUnlocks = absorbPaletteUnlockBaseline(prev.runUnlocks, ids);
    if (runUnlocks.join('\n') === prev.runUnlocks.join('\n')) return;
    const next = { ...prev, runUnlocks };
    // The profile grant and its run-recap baseline must survive the same immediate reload.
    if (prev.runStarted) writeRun(serializeRun(next));
    setState(next);
  }, []);

  return {
    state,
    getLexicon,
    canPlay:
      state.phase === 'playing' &&
      !state.pendingEnd &&
      state.settleComplete &&
      state.selected.length > 0 &&
      state.blind.phasesUsed < state.blind.phasesTotal,
    canDiscard:
      state.phase === 'playing' &&
      !state.pendingEnd &&
      state.settleComplete &&
      state.blind.discardsLeft > 0,
    toggleTile,
    reorderHand,
    reorderJokers,
    reorderStaged,
    useConsumable,
    buyAndUse,
    canUseConsumable: (id) => {
      // On the board, both Fables and Gamblers expose their live engine preconditions.
      if (state.phase === 'playing' && !state.pendingEnd) {
        if (isGamblerId(id)) {
          return canUseGambler(
            id,
            state.run,
            state.blind.hand,
            state.selected,
            unlockedEmojiSet(),
          );
        }
        return !isFableId(id) || canUseFable(
          id,
          state.run,
          state.blind,
          state.selected,
          unlockedEmojiSet(),
        );
      }
      // In the shop (feedback 5): tile-targeting and blind-only Fables must be held
      // for a blind. Non-tile Fables use their own precondition; Constellations level.
      if (state.phase === 'shop') {
        if (isBlindOnlyConsumable(id) || fableTargetsTiles(id)) return false;
        if (isGamblerId(id)) {
          return canUseGambler(id, state.run, [], [], unlockedEmojiSet());
        }
        if (!isFableId(id)) return true;
        return canUseFable(id, state.run, state.blind, [], unlockedEmojiSet());
      }
      return false;
    },
    canMagnify:
      state.phase === 'playing' &&
      (state.run.consumables.includes('magnifier') || state.run.consumables.includes('fable1')),
    sellConsumable,
    buy,
    sell,
    reroll,
    leaveShop,
    clearShopTagRedemptions,
    buyVoucher: buyVoucherAction,
    rerollBoss,
    buyPack,
    pickPackOption,
    usePackFable,
    usePackGambler,
    usePackConstellation,
    useHeldPackFable,
    useHeldPackGambler,
    closePack,
    playWord,
    discard,
    selectBlind,
    clearBlindEntryEffects,
    skipBlind,
    confirmCashout,
    markSettleComplete,
    continueEndless,
    acknowledgeUnlocks,
    absorbPaletteUnlocks,
    endRun,
    newGame,
    startRun,
  };
}
