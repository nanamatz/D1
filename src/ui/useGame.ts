/**
 * The game controller. Owns run + blind state and routes every action through
 * the headless engine. Randomness is reproducible: a fresh seeded RNG per
 * random op, keyed `seed#counter`, so no stateful RNG ref is needed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { newRun } from '../engine/run';
import { makeRng } from '../engine/rng';
import {
  startBlind,
  submitWord,
  exchangeTiles,
  canEndEarly,
  endBlind,
} from '../engine/loop';
import { resolveBlind } from '../engine/progression';
import type {
  BlindState,
  ConsumableId,
  OwnedJoker,
  RunState,
  ScoreEvent,
  ShopState,
} from '../engine/types';
import { rollShopStock, buyItem, sellJoker, rerollShop } from '../engine/shop';
import { findSpellableWords, type HintWord } from '../engine/hint';
import { loadBrowserLexicon } from './lexicon.browser';
import { recordWord } from './collection';
import { reorderIds, type MessageSpec, type Phase } from './game';

const STARTING_JOKERS: readonly string[] = ['vowelPraise', 'hipster', 'grammarian'];

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
  /** last played word (for collection tracking); null on a fresh blind */
  lastPlayed: { text: string; isGibberish: boolean } | null;
  /** Magnifier result: up to 3 spellable words to highlight, or null */
  hint: HintWord[] | null;
  /** shop stock while phase === 'shop', else null */
  shop: ShopState | null;
}

function equip(run: RunState, defIds: readonly string[]): RunState {
  const jokers: OwnedJoker[] = defIds.map((defId) => ({ defId, state: {} }));
  return { ...run, jokers };
}

function bootstrap(): GameState {
  const seed = Math.random().toString(36).slice(2);
  const run: RunState = {
    ...equip(newRun(seed), STARTING_JOKERS),
    consumables: ['magnifier'] as ConsumableId[], // one hint to start (economy in a later slice)
  };
  const blind = startBlind(run, makeRng(`${seed}#0`));
  return {
    seed,
    rngCounter: 1,
    run,
    blind,
    selected: [],
    phase: 'playing',
    message: null,
    lastEvents: [],
    settleId: 0,
    lastPlayed: null,
    hint: null,
    shop: null,
  };
}

export interface UseGame {
  state: GameState;
  lexicon: ReturnType<typeof loadBrowserLexicon>;
  canPlay: boolean;
  canExchange: boolean;
  canCash: boolean;
  toggleTile: (id: string) => void;
  reorderHand: (fromId: string, toId: string) => void;
  reorderStaged: (fromId: string, toId: string) => void;
  useMagnifier: () => void;
  canMagnify: boolean;
  buy: (index: number) => void;
  sell: (index: number) => void;
  reroll: () => void;
  leaveShop: () => void;
  playWord: () => void;
  exchange: () => void;
  cashOut: () => void;
  newGame: () => void;
}

export function useGame(): UseGame {
  const lexicon = useMemo(() => loadBrowserLexicon(), []);
  const [state, setState] = useState<GameState>(bootstrap);

  // Word collection (P2-2): record each non-gibberish play once it settles.
  useEffect(() => {
    const lp = state.lastPlayed;
    if (lp && !lp.isGibberish) recordWord(lp.text);
    // keyed on the submission counter — records exactly once per play
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settleId]);

  /** Judge & resolve the current blind, then advance or end the run. */
  const finalize = useCallback(
    (s: GameState): GameState => {
      const final = endBlind(s.blind, s.run, lexicon);
      const outcome = resolveBlind(s.run, s.blind, final.finalScore);
      if (!outcome.cleared) {
        return {
          ...s,
          phase: 'gameover',
          message: {
            key: 'msg.gameover',
            params: { score: Math.round(final.finalScore), target: s.blind.target, ante: s.run.ante },
          },
        };
      }
      // Cleared → enter the shop before the next blind (GDD §9).
      const rng = makeRng(`${s.seed}#${s.rngCounter}`);
      const shop = rollShopStock(outcome.run, rng);
      const e = outcome.earned;
      return {
        ...s,
        run: outcome.run,
        phase: 'shop',
        shop,
        selected: [],
        hint: null,
        rngCounter: s.rngCounter + 1,
        message: {
          key: 'msg.cleared',
          params: { total: e.total, reward: e.reward, phases: e.phases, interest: e.interest },
        },
      };
    },
    [lexicon],
  );

  const buy = useCallback((index: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const res = buyItem(prev.run, prev.shop, index);
      return res.ok ? { ...prev, run: res.run, shop: res.shop } : prev;
    });
  }, []);

  const sell = useCallback((index: number) => {
    setState((prev) => {
      if (prev.phase !== 'shop') return prev;
      const res = sellJoker(prev.run, index);
      return res.ok ? { ...prev, run: res.run } : prev;
    });
  }, []);

  const reroll = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop' || !prev.shop) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const res = rerollShop(prev.run, prev.shop, rng);
      return res.ok ? { ...prev, run: res.run, shop: res.shop, rngCounter: prev.rngCounter + 1 } : prev;
    });
  }, []);

  const leaveShop = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'shop') return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const blind = startBlind(prev.run, rng);
      return {
        ...prev,
        phase: 'playing',
        blind,
        shop: null,
        selected: [],
        hint: null,
        message: null,
        rngCounter: prev.rngCounter + 1,
      };
    });
  }, []);

  const toggleTile = useCallback((id: string) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || !prev.blind.hand.some((t) => t.id === id)) return prev;
      const selected = prev.selected.includes(id)
        ? prev.selected.filter((x) => x !== id)
        : [...prev.selected, id];
      return { ...prev, selected, hint: null };
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
      return { ...prev, blind: { ...prev.blind, hand }, hint: null };
    });
  }, []);

  const reorderStaged = useCallback((fromId: string, toId: string) => {
    setState((prev) =>
      prev.phase !== 'playing'
        ? prev
        : { ...prev, selected: reorderIds(prev.selected, fromId, toId), hint: null },
    );
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
      const { blind, events, submission } = submitWord(prev.blind, prev.run, lexicon, prev.selected);
      const next: GameState = {
        ...prev,
        blind,
        selected: [],
        message: null,
        lastEvents: events,
        settleId: prev.settleId + 1,
        lastPlayed: { text: submission.text, isGibberish: submission.isGibberish },
        hint: null,
      };
      // No phases left → the blind ends automatically (GDD §7.2).
      return blind.phasesUsed >= blind.phasesTotal ? finalize(next) : next;
    });
  }, [lexicon, finalize]);

  const exchange = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.selected.length === 0) return prev;
      if (prev.selected.length > prev.blind.exchangeSize || prev.blind.exchangesLeft <= 0) return prev;
      const rng = makeRng(`${prev.seed}#${prev.rngCounter}`);
      const blind = exchangeTiles(prev.blind, prev.selected, rng);
      return { ...prev, blind, selected: [], rngCounter: prev.rngCounter + 1, message: null, hint: null };
    });
  }, []);

  const cashOut = useCallback(() => {
    setState((prev) =>
      prev.phase === 'playing' && canEndEarly(prev.blind) ? finalize(prev) : prev,
    );
  }, [finalize]);

  const newGame = useCallback(() => setState(bootstrap()), []);

  return {
    state,
    lexicon,
    canPlay: state.phase === 'playing' && state.selected.length > 0 && state.blind.phasesUsed < state.blind.phasesTotal,
    canExchange:
      state.phase === 'playing' &&
      state.selected.length > 0 &&
      state.selected.length <= state.blind.exchangeSize &&
      state.blind.exchangesLeft > 0,
    canCash: state.phase === 'playing' && canEndEarly(state.blind),
    toggleTile,
    reorderHand,
    reorderStaged,
    useMagnifier,
    canMagnify: state.phase === 'playing' && state.run.consumables.includes('magnifier'),
    buy,
    sell,
    reroll,
    leaveShop,
    playWord,
    exchange,
    cashOut,
    newGame,
  };
}
