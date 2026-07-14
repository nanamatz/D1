/**
 * The game controller. Owns run + blind state and routes every action through
 * the headless engine. Randomness is reproducible: a fresh seeded RNG per
 * random op, keyed `seed#counter`, so no stateful RNG ref is needed.
 */
import { useCallback, useMemo, useState } from 'react';
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
import type { BlindState, OwnedJoker, RunState } from '../engine/types';
import { loadBrowserLexicon } from './lexicon.browser';
import type { Phase } from './game';

const STARTING_JOKERS: readonly string[] = ['vowelPraise', 'hipster', 'grammarian'];

export interface GameState {
  seed: string;
  rngCounter: number;
  run: RunState;
  blind: BlindState;
  selected: string[];
  phase: Phase;
  message: string | null;
}

function equip(run: RunState, defIds: readonly string[]): RunState {
  const jokers: OwnedJoker[] = defIds.map((defId) => ({ defId, state: {} }));
  return { ...run, jokers };
}

function bootstrap(): GameState {
  const seed = Math.random().toString(36).slice(2);
  const run = equip(newRun(seed), STARTING_JOKERS);
  const blind = startBlind(run, makeRng(`${seed}#0`));
  return { seed, rngCounter: 1, run, blind, selected: [], phase: 'playing', message: null };
}

export interface UseGame {
  state: GameState;
  lexicon: ReturnType<typeof loadBrowserLexicon>;
  canPlay: boolean;
  canExchange: boolean;
  canCash: boolean;
  toggleTile: (id: string) => void;
  playWord: () => void;
  exchange: () => void;
  cashOut: () => void;
  newGame: () => void;
}

export function useGame(): UseGame {
  const lexicon = useMemo(() => loadBrowserLexicon(), []);
  const [state, setState] = useState<GameState>(bootstrap);

  /** Judge & resolve the current blind, then advance or end the run. */
  const finalize = useCallback(
    (s: GameState): GameState => {
      const final = endBlind(s.blind, s.run, lexicon);
      const outcome = resolveBlind(s.run, s.blind, final.finalScore);
      if (!outcome.cleared) {
        return {
          ...s,
          phase: 'gameover',
          message: `Game over — scored ${final.finalScore} of ${s.blind.target}. Reached ante ${s.run.ante}.`,
        };
      }
      const rng = makeRng(`${s.seed}#${s.rngCounter}`);
      const nextBlind = startBlind(outcome.run, rng);
      const e = outcome.earned;
      return {
        ...s,
        run: outcome.run,
        blind: nextBlind,
        selected: [],
        rngCounter: s.rngCounter + 1,
        message: `Cleared! +$${e.total}  (reward ${e.reward} · ${e.phases} phases · ${e.interest} interest)`,
      };
    },
    [lexicon],
  );

  const toggleTile = useCallback((id: string) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || !prev.blind.hand.some((t) => t.id === id)) return prev;
      const selected = prev.selected.includes(id)
        ? prev.selected.filter((x) => x !== id)
        : [...prev.selected, id];
      return { ...prev, selected };
    });
  }, []);

  const playWord = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.selected.length === 0) return prev;
      if (prev.blind.phasesUsed >= prev.blind.phasesTotal) return prev;
      const { blind } = submitWord(prev.blind, prev.run, lexicon, prev.selected);
      const next: GameState = { ...prev, blind, selected: [], message: null };
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
      return { ...prev, blind, selected: [], rngCounter: prev.rngCounter + 1, message: null };
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
    playWord,
    exchange,
    cashOut,
    newGame,
  };
}
