/**
 * The game controller. Owns run + blind state and routes every action through
 * the headless engine. Randomness is reproducible: a fresh seeded RNG per
 * random op, keyed `seed#counter`, so no stateful RNG ref is needed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newRun } from '../engine/run';
import { makeRng } from '../engine/rng';
import { startBlind, submitWord, discardTiles, endBlind } from '../engine/loop';
import { resolveBlind, type BlindEarnings } from '../engine/progression';
import { drawBoss } from '../engine/bosses';
import { tutorialBus } from './tutorial';
import { checkWordPlayed, unlockBus } from './unlocks';
import type {
  BlindKind,
  BlindState,
  PatternId,
  RunState,
  ScoreEvent,
  ShopState,
} from '../engine/types';
import {
  rollShopStock,
  buyItem,
  sellJoker,
  rerollShop,
  buyVoucher,
  rollVoucherOffer,
  rollExtraItem,
} from '../engine/shop';
import { sellValue } from '../engine/economy';
import { rollPack, applyPackPick, type PackOffer } from '../engine/packs';
import { BALANCE } from '../engine/balance';
import { findSpellableWords, type HintWord } from '../engine/hint';
import { loadBrowserLexicon } from './lexicon.browser';
import { recordWord } from './collection';
import { recordRunEnd } from './lifetime';
import { loadRun, serializeRun, writeRun } from './persist';
import { reorderIds, type MessageSpec, type Phase } from './game';
import { audio } from './audio';

/** Snapshot of the losing blind, for the Game Over screen (spec §2.7). */
export interface GameOverInfo {
  finalScore: number;
  target: number;
  ante: number;
  blindKind: BlindKind;
  bossId: string | null;
  /** true when the run ended by clearing the final chapter's Deadline (a win) */
  won: boolean;
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
  discoveries: 0,
});

export interface GameState {
  seed: string;
  rngCounter: number;
  run: RunState;
  blind: BlindState;
  selected: string[];
  phase: Phase;
  message: MessageSpec | null;
  /** the most recent submission's settle log + a counter to retrigger replay */
  lastEvents: ScoreEvent[];
  settleId: number;
  /** committed score BEFORE the in-flight settle — lets the round number climb
   *  from the old committed to the new one during the animation (playtest-04 A-1) */
  committedBefore: number;
  /** last played word (for collection tracking); null on a fresh blind */
  lastPlayed: { text: string; isGibberish: boolean } | null;
  /** Magnifier result: up to 3 spellable words to highlight, or null */
  hint: HintWord[] | null;
  /** shop stock while phase === 'shop', else null */
  shop: ShopState | null;
  /** an open pack awaiting selection, else null */
  pack: { offer: PackOffer; picksLeft: number } | null;
  /** blind settlement line items while phase === 'cashout', else null */
  cashout: BlindEarnings | null;
  /** the advanced run (gold + next chapter/blind) to apply when Fee Settlement is
   *  confirmed — kept pending so the board stays frozen on the cleared blind (A-2) */
  pendingRun: RunState | null;
  /** losing-blind snapshot while phase === 'gameover', else null */
  gameover: GameOverInfo | null;
  /** per-run display stats (Game Over screen) */
  stats: RunStats;
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
   * The blind's finalized score (committed + the sentence bonus), set once the
   * last settle lands. Non-null means the SENTENCE BONUS IS LANDING on the round
   * number right now (playtest-06 item 1): the bonus is only finalized at blind
   * end (GDD §7.1), so without this beat the clear screen arrived while the round
   * number still showed committed-only and the player never saw *why* it cleared.
   * Null at every other time — the bonus stays a separate forecast during play.
   */
  finalScore: number | null;
  /**
   * The player actually started this run (vs. the idle run `bootstrap` always
   * builds so the board has something to render). Gates the New Run screen's
   * Continue tab, and lives in state — rather than in App — so it persists with
   * the save and survives a reload.
   */
  runStarted: boolean;
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

function bootstrap(seed: string = randomSeed()): GameState {
  // runs start empty — jokers/consumables are acquired in the shop (was: 3 demo jokers + a magnifier)
  const base: RunState = newRun(seed);
  // Chapter 1's voucher offer + Deadline boss (fixed per chapter; playtest-03 C, 04 D-6).
  const run: RunState = {
    ...base,
    voucherOffer: rollVoucherOffer(base, makeRng(`${seed}#voucher-1`)),
    chapterBossId: drawBoss(makeRng(`${seed}#boss-1`)),
  };
  const blind = startBlind(run, makeRng(`${seed}#0`), { bossId: run.chapterBossId });
  return {
    seed,
    rngCounter: 1,
    run,
    blind,
    selected: [],
    phase: 'blindselect',
    message: null,
    lastEvents: [],
    settleId: 0,
    committedBefore: 0,
    lastPlayed: null,
    hint: null,
    shop: null,
    pack: null,
    cashout: null,
    pendingRun: null,
    gameover: null,
    stats: freshStats(),
    pendingEnd: false,
    settleComplete: true,
    finalScore: null,
    runStarted: false,
  };
}

export interface UseGame {
  state: GameState;
  lexicon: ReturnType<typeof loadBrowserLexicon>;
  canPlay: boolean;
  canDiscard: boolean;
  toggleTile: (id: string) => void;
  reorderHand: (fromId: string, toId: string) => void;
  reorderJokers: (from: number, to: number) => void;
  reorderStaged: (fromId: string, toId: string) => void;
  useMagnifier: () => void;
  canMagnify: boolean;
  sellConsumable: (index: number) => void;
  buy: (index: number) => void;
  sell: (index: number) => void;
  reroll: () => void;
  leaveShop: () => void;
  buyVoucher: () => void;
  buyPack: (index: number) => void;
  pickPackOption: (index: number) => void;
  closePack: () => void;
  playWord: () => void;
  discard: (ids: string[]) => void;
  selectBlind: () => void;
  confirmCashout: () => void;
  /** SettleProvider's completion signal — the settle timeline has finished (05 A). */
  markSettleComplete: () => void;
  newGame: () => void;
  /** Start a fresh run from a specific seed (New Run screen); random if omitted. */
  startRun: (seed?: string) => void;
}

export function useGame(): UseGame {
  const lexicon = useMemo(() => loadBrowserLexicon(), []);
  // Resume a saved run if there is one; otherwise the idle bootstrap run.
  const [state, setState] = useState<GameState>(() => loadRun() ?? bootstrap());

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

  // Record each finished run into the lifetime stats exactly once (spec §2.12).
  // Keyed on the gameover snapshot identity so StrictMode re-runs don't double-count.
  const recordedGameOver = useRef<GameOverInfo | null>(null);
  useEffect(() => {
    const go = state.gameover;
    if (go && recordedGameOver.current !== go) {
      recordedGameOver.current = go;
      recordRunEnd({ ante: go.ante, gold: state.run.gold, bestWord: state.stats.bestWord });
    }
  }, [state.gameover, state.run.gold, state.stats.bestWord]);

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
      const final = endBlind(s.blind, s.run, lexicon);
      const runWithMaterialGold: RunState = {
        ...s.run,
        gold: s.run.gold + final.materialGold,
      };
      const outcome = resolveBlind(runWithMaterialGold, s.blind, final.finalScore);
      // Tally the finalized sentence pattern for "most played pattern" (§2.7).
      const patternCounts = { ...s.stats.patternCounts };
      const p = final.judgment.match?.pattern;
      if (p) patternCounts[p] = (patternCounts[p] ?? 0) + 1;
      const stats: RunStats = { ...s.stats, patternCounts };

      if (!outcome.cleared) {
        return {
          ...s,
          run: outcome.run,
          stats,
          phase: 'gameover',
          gameover: {
            finalScore: Math.round(final.finalScore),
            target: s.blind.target,
            ante: outcome.run.ante,
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: false,
          },
        };
      }
      // Final-chapter Deadline cleared → the run is WON (spec 2026-07-19).
      // Skip Fee Settlement/shop for now; outcome.run (advanced, paid out) is
      // still applied so the planned endless mode can later route this through
      // the normal cashout path instead.
      if (outcome.won) {
        return {
          ...s,
          run: outcome.run,
          stats,
          phase: 'gameover',
          gameover: {
            finalScore: Math.round(final.finalScore),
            target: s.blind.target,
            ante: s.run.ante, // the chapter just completed, not the advanced one
            blindKind: s.blind.kind,
            bossId: s.blind.bossId,
            won: true,
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
        advancedRun = {
          ...advancedRun,
          voucherOffer: rollVoucherOffer(advancedRun, makeRng(`${s.seed}#voucher-${advancedRun.ante}`)),
          voucherLocked: false,
          chapterBossId: drawBoss(makeRng(`${s.seed}#boss-${advancedRun.ante}`)),
          wordsThisAnte: [], // new ante → Memoirs' pool resets (회고록)
        };
      }
      const rng = makeRng(`${s.seed}#${s.rngCounter}`);
      const shop = rollShopStock(advancedRun, rng);
      // Keep s.run / s.blind on the CLEARED blind so the board stays frozen behind
      // the Fee Settlement overlay (A-2); the advanced run applies on confirm.
      return {
        ...s,
        stats,
        phase: 'cashout',
        cashout: outcome.earned,
        pendingRun: advancedRun,
        shop,
        selected: [],
        hint: null,
        message: null,
        rngCounter: s.rngCounter + 1,
      };
    },
    [lexicon],
  );

  const buy = useCallback((index: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const res = buyItem(prev.run, prev.shop, index);
      if (!res.ok) return prev;
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
    setState((prev) => {
      if (prev.phase !== 'shop' && prev.phase !== 'playing') return prev;
      const res = sellJoker(prev.run, index);
      if (!res.ok) return prev;
      audio.play('sell');
      return { ...prev, run: res.run };
    });
  }, []);

  const reroll = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const res = rerollShop(prev.run, prev.shop, rng);
      if (!res.ok) return prev;
      audio.play('reroll');
      return {
        ...prev,
        run: res.run,
        shop: res.shop,
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, rerollsUsed: prev.stats.rerollsUsed + 1 },
      };
    });
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
        selected: [],
        hint: null,
        message: null,
        // B-1: reset EVERY piece of per-blind UI state so the next blind's first
        // frame is clean (no stale tiles / settle / score remnants).
        lastEvents: [],
        settleId: 0,
        committedBefore: 0,
        lastPlayed: null,
        pendingEnd: false,
        settleComplete: true,
        finalScore: null,
        rngCounter: prev.rngCounter + 1,
      };
    });
  }, []);

  /** Fee Settlement confirmed → apply the advanced run and open the shop. */
  const confirmCashout = useCallback(() => {
    setState((prev) =>
      prev.phase === 'cashout' && prev.pendingRun
        ? { ...prev, phase: 'shop', run: prev.pendingRun, pendingRun: null, cashout: null }
        : prev,
    );
  }, []);

  /** Blind Select (§2.3) confirmed → begin the (already-drawn) blind. */
  const selectBlind = useCallback(() => {
    setState((prev) => (prev.phase === 'blindselect' ? { ...prev, phase: 'playing' } : prev));
  }, []);

  /** SettleProvider signals the settle timeline has landed — arms the clear UI (05 A). */
  const markSettleComplete = useCallback(() => {
    setState((prev) => (prev.settleComplete ? prev : { ...prev, settleComplete: true }));
  }, []);

  const buyVoucherAction = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const boughtId = prev.shop.voucher;
      const res = buyVoucher(prev.run, prev.shop);
      if (!res.ok) return prev;
      audio.play('voucherRedeem');
      tutorialBus.fire('firstVoucher');
      // B-2: Wide Shelf's +1 item slot fills immediately, this same visit.
      let shop = res.shop;
      let rngCounter = prev.rngCounter;
      if (boughtId === 'wideShelf') {
        const extra = rollExtraItem(res.run, res.shop.items, makeRng(`${prev.seed}#${rngCounter}`));
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
      const price = BALANCE.pack.size[slot.size].price;
      if (prev.run.gold < price) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const offer = rollPack(slot, prev.run, rng);
      const packs = prev.shop.packs.slice();
      packs[index] = null;
      audio.play('packOpen');
      tutorialBus.fire('firstPack');
      return {
        ...prev,
        run: { ...prev.run, gold: prev.run.gold - price },
        shop: { ...prev.shop, packs },
        pack: { offer, picksLeft: offer.pick },
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
      const run = applyPackPick(prev.run, option);
      const options = prev.pack.offer.options.filter((_, i) => i !== optionIndex);
      const picksLeft = prev.pack.picksLeft - 1;
      const pack =
        picksLeft <= 0 || options.length === 0
          ? null
          : { offer: { ...prev.pack.offer, options }, picksLeft };
      return { ...prev, run, pack };
    });
  }, []);

  const closePack = useCallback(() => setState((prev) => ({ ...prev, pack: null })), []);

  const toggleTile = useCallback((id: string) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.pendingEnd || !prev.blind.hand.some((t) => t.id === id))
        return prev;
      const selected = prev.selected.includes(id)
        ? prev.selected.filter((x) => x !== id)
        : [...prev.selected, id];
      // E-4: keep the magnifier hint (and its tile highlights) visible while
      // staging — it only clears on Play or Discard.
      return { ...prev, selected };
    });
  }, []);

  const reorderHand = useCallback((fromId: string, toId: string) => {
    setState((prev) => {
      if (prev.phase !== 'playing') return prev;
      const ids = reorderIds(
        prev.blind.hand.map((t) => t.id),
        fromId,
        toId,
      );
      const byId = new Map(prev.blind.hand.map((t) => [t.id, t]));
      const hand = ids.map((id) => byId.get(id)!);
      return { ...prev, blind: { ...prev.blind, hand } };
    });
  }, []);

  const reorderStaged = useCallback((fromId: string, toId: string) => {
    setState((prev) =>
      prev.phase !== 'playing'
        ? prev
        : { ...prev, selected: reorderIds(prev.selected, fromId, toId) },
    );
  }, []);

  // D-1: drag-reorder the owned-joker shelf. Order IS hook-execution order
  // (loop.ts iterates run.jokers), so this is strategic (additive-before-
  // multiplicative). Persisted in run state; index-based since jokers can dup.
  const reorderJokers = useCallback((from: number, to: number) => {
    setState((prev) => {
      const jokers = prev.run.jokers;
      if (from < 0 || to < 0 || from >= jokers.length || to >= jokers.length || from === to) {
        return prev;
      }
      const next = jokers.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return { ...prev, run: { ...prev.run, jokers: next } };
    });
  }, []);

  const useMagnifier = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing' || !prev.run.consumables.includes('magnifier')) return prev;
      const idx = prev.run.consumables.indexOf('magnifier');
      const consumables = prev.run.consumables.slice();
      consumables.splice(idx, 1);
      const hint = findSpellableWords(prev.blind.hand, lexicon, 3);
      return { ...prev, run: { ...prev.run, consumables }, hint };
    });
  }, [lexicon]);

  const playWord = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.selected.length === 0) return prev;
      if (prev.blind.phasesUsed >= prev.blind.phasesTotal) return prev;
      let result;
      try {
        result = submitWord(
          prev.blind,
          prev.run,
          lexicon,
          prev.selected,
          makeRng(`${prev.seed}#${prev.rngCounter}`),
        );
      } catch {
        // Boss legality (e.g. The Noun Lock) — surface, don't crash.
        return { ...prev, message: { key: 'boss.blocked' } };
      }
      const { blind, events, submission, goldDelta, destroyedTileIds } = result;
      if (submission.isGibberish) tutorialBus.fire('firstGibberish');
      // Chromatic unlocks (feature-02 C): a VALID word may write a presentation
      // layer into the world on its first-ever play. Gibberish never unlocks.
      if (!submission.isGibberish) {
        const unlocked = checkWordPlayed(submission.text);
        if (unlocked) unlockBus.emit(unlocked);
      }
      // A-2: a per-word structure bonus (Twin/Vowel Flush/Straight…) landed —
      // explain Letter Hands the first time one actually scores. The event is
      // only present when a hand triggered (loop.ts), so its presence is the signal.
      if (events.some((e) => e.kind === 'letterHand')) tutorialBus.fire('firstLetterHand');
      const nextRun: RunState = {
        ...prev.run,
        gold: Math.max(0, prev.run.gold + goldDelta),
        bag: destroyedTileIds.length
          ? prev.run.bag.filter((t) => !destroyedTileIds.includes(t.id))
          : prev.run.bag,
        // Track played words this ante for the Memoirs boss (회고록); gibberish is
        // never tracked. Reset per ante in finalize when the chapter's Deadline clears.
        wordsThisAnte: submission.isGibberish
          ? prev.run.wordsThisAnte
          : [...prev.run.wordsThisAnte, submission.text.toLowerCase()],
      };
      const best = prev.stats.bestWord;
      const bestWord =
        !submission.isGibberish && (!best || submission.settledScore > best.score)
          ? { text: submission.text, score: Math.round(submission.settledScore) }
          : best;
      const next: GameState = {
        ...prev,
        run: nextRun,
        blind,
        selected: [],
        message: null,
        lastEvents: events,
        settleId: prev.settleId + 1,
        // A new settle starts; the completion signal re-arms (05 A) so the clear
        // UI waits for THIS word's settle to land, not the previous one's.
        settleComplete: false,
        finalScore: null,
        // committed BEFORE this word, so the round number climbs to the new
        // committed during the settle rather than snapping (A-1).
        committedBefore: prev.blind.committedScore,
        lastPlayed: { text: submission.text, isGibberish: submission.isGibberish },
        hint: null,
        stats: { ...prev.stats, wordsPlayed: prev.stats.wordsPlayed + 1, bestWord },
        rngCounter: prev.rngCounter + 1,
      };
      // Auto-settle (playtest-03 B): the blind ends the moment the projected
      // total (committed + sentence bonus) reaches the target — no manual button.
      // The Perfectionist disables it (settles only when phases run out). Either
      // way the board stays visible so the full settle + sentence-finalize plays
      // before Fee Settlement; a timer runs finalize.
      const phasesOut = blind.phasesUsed >= blind.phasesTotal;
      const autoSettle = !blind.earlyEndDisabled && blind.projectedScore >= blind.target;
      return phasesOut || autoSettle ? { ...next, pendingEnd: true } : next;
    });
  }, [lexicon]);

  // Resolve the blind (→ Fee Settlement on a win, → Game Over on a loss) ONLY
  // after the settle-complete signal fires — never on the raw final score, which
  // is known instantly (playtest-05 A; recurrence of 04 A-1, unifying 04 A-2: the
  // deciding sentence bonus must be *seen* pushing the score over first). The
  // signal already tracks the variable settle length (long words settle longer).
  // Stage 1 — the last word's settle has landed: publish the finalized score so the
  // sentence bonus counts up onto the round number (06 #1).
  useEffect(() => {
    if (!state.pendingEnd || !state.settleComplete || state.finalScore !== null) return;
    const { finalScore } = endBlind(state.blind, state.run, lexicon);
    setState((prev) =>
      prev.pendingEnd && prev.finalScore === null ? { ...prev, finalScore } : prev,
    );
  }, [state.pendingEnd, state.settleComplete, state.finalScore, state.blind, state.run, lexicon]);

  // Stage 2 — the round number is fully updated (settle beats + bonus). Hold a short
  // beat so the cleared score is seen, then auto-resolve to Fee Settlement / Game Over
  // (item 4: the intermediate "Cleared! + Settle button" screen was removed — the Fee
  // Settlement modal, with its own Collect button, is the only clear screen now).
  useEffect(() => {
    if (!state.pendingEnd || state.finalScore === null) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setTimeout(
      () => setState((prev) => (prev.pendingEnd ? { ...finalize(prev), pendingEnd: false } : prev)),
      reduce ? VERDICT_BEAT_REDUCED_MS : BONUS_LAND_MS + VERDICT_BEAT_MS,
    );
    return () => clearTimeout(id);
  }, [state.pendingEnd, state.finalScore, finalize]);

  // C-3: discard acts on an explicit set of MARKED hand tiles, independent of
  // what is staged in the tile zone. Tiles exit for the blind (draw is RNG-free;
  // the rng is used only for discardGain font seal rolls, GDD §2.3).
  const discard = useCallback((ids: string[]) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.pendingEnd) return prev;
      if (prev.blind.discardsLeft <= 0) return prev;
      const staged = new Set(prev.selected);
      const valid = ids.filter((id) => !staged.has(id) && prev.blind.hand.some((t) => t.id === id));
      if (valid.length === 0) return prev; // no per-use tile cap (D-4)
      const { blind, gained, slotsBlocked } = discardTiles(
        prev.blind,
        prev.run,
        valid,
        makeRng(`${prev.seed}#${prev.rngCounter}`),
      );
      return {
        ...prev,
        blind,
        run: gained.length
          ? { ...prev.run, consumables: [...prev.run.consumables, ...gained] }
          : prev.run,
        message: slotsBlocked > 0 ? { key: 'font.slotsFull' } : null,
        hint: null,
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, tilesDiscarded: prev.stats.tilesDiscarded + valid.length },
      };
    });
  }, []);

  /** Sell a held consumable for half its price (C-4 Use/Sell menu). */
  const sellConsumable = useCallback((index: number) => {
    setState((prev) => {
      const c = prev.run.consumables[index];
      if (!c) return prev;
      const consumables = prev.run.consumables.slice();
      consumables.splice(index, 1);
      const gold = prev.run.gold + sellValue(BALANCE.consumablePrice);
      return { ...prev, run: { ...prev.run, consumables, gold } };
    });
  }, []);

  const newGame = useCallback(() => setState({ ...bootstrap(), runStarted: true }), []);
  const startRun = useCallback(
    (seed?: string) =>
      setState({
        ...bootstrap(seed && seed.trim() ? seed.trim() : undefined),
        runStarted: true,
      }),
    [],
  );

  return {
    state,
    lexicon,
    canPlay:
      state.phase === 'playing' &&
      !state.pendingEnd &&
      state.selected.length > 0 &&
      state.blind.phasesUsed < state.blind.phasesTotal,
    canDiscard: state.phase === 'playing' && !state.pendingEnd && state.blind.discardsLeft > 0,
    toggleTile,
    reorderHand,
    reorderJokers,
    reorderStaged,
    useMagnifier,
    canMagnify: state.phase === 'playing' && state.run.consumables.includes('magnifier'),
    sellConsumable,
    buy,
    sell,
    reroll,
    leaveShop,
    buyVoucher: buyVoucherAction,
    buyPack,
    pickPackOption,
    closePack,
    playWord,
    discard,
    selectBlind,
    confirmCashout,
    markSettleComplete,
    newGame,
    startRun,
  };
}
