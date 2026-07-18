import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import type { BlindState, Letter, RunState, ScoreEvent, Tile } from '../src/engine/types';

const lex = makeLexicon([], { cat: { suit: 'standard', pos: ['noun'] } });

const equip = (seed: string, ...defIds: string[]): RunState => ({
  ...newRun(seed),
  jokers: defIds.map((defId) => ({ defId, state: {} })),
});

let idc = 0;
const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `e${idc++}`,
    letter: c as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

const play = (run: RunState, word: string): { events: ScoreEvent[]; settled: number } => {
  const blind: BlindState = startBlind(run, makeRng(run.seed));
  const hand = tilesFor(word);
  const res = submitWord({ ...blind, hand }, run, lex, hand.map((t) => t.id), makeRng('test'));
  return { events: res.events, settled: res.submission.settledScore };
};

describe('P1-3a — per-submission ScoreEvent log (settle choreography source)', () => {
  it('emits a chip event per tile, in spelling order', () => {
    const { events } = play(newRun('x'), 'cat');
    const tiles = events.filter((e) => e.kind === 'tile');
    expect(tiles.map((e) => (e.kind === 'tile' ? [e.letter, e.chips] : null))).toEqual([
      ['C', 3],
      ['A', 1],
      ['T', 1],
    ]);
  });

  it('emits the suit multiplier event after the tiles', () => {
    const { events } = play(newRun('x'), 'cat');
    const suit = events.find((e) => e.kind === 'suit');
    expect(suit).toEqual({ kind: 'suit', suit: 'standard', mult: 1 });
  });

  it('records per-tile jokers per consonant (with a tileId) and per-word jokers once', () => {
    const run = equip('j', 'consonantBricklayer', 'jackOfAllTrades');
    const { events, settled } = play(run, 'cat'); // C, T consonants; A vowel
    const jokers = events.filter((e) => e.kind === 'joker');
    // Consonant Bricklayer (per-tile, item 3) fires once per consonant, each carrying
    // the tile it landed on; Jack of All Trades (per-word) fires once, no tileId.
    const brick = jokers.filter((e) => e.kind === 'joker' && e.jokerId === 'consonantBricklayer');
    const jack = jokers.filter((e) => e.kind === 'joker' && e.jokerId === 'jackOfAllTrades');
    expect(brick.length).toBe(2);
    for (const e of brick) {
      expect(e).toMatchObject({ chipsDelta: 4, multDelta: 0 });
      expect(e.kind === 'joker' && e.tileId).toBeTruthy();
    }
    expect(jack).toEqual([{ kind: 'joker', jokerId: 'jackOfAllTrades', chipsDelta: 0, multDelta: 4 }]);
    // Per-tile jokers precede the per-word joker (acquisition order preserved).
    expect(jokers.map((e) => (e.kind === 'joker' ? e.jokerId : ''))).toEqual([
      'consonantBricklayer',
      'consonantBricklayer',
      'jackOfAllTrades',
    ]);
    // settle = (5 + 8) chips × (1 + 4) mult = 65 — total unchanged from the batch path
    expect(settled).toBe(65);
  });

  it('ends with a settle event carrying the final chips/mult/total', () => {
    const run = equip('j', 'consonantBricklayer', 'jackOfAllTrades');
    const { events } = play(run, 'cat');
    expect(events.at(-1)).toEqual({ kind: 'settle', chips: 13, mult: 5, total: 65 });
  });

  it('omits joker events for a jokerless run', () => {
    const { events, settled } = play(newRun('x'), 'cat');
    expect(events.some((e) => e.kind === 'joker')).toBe(false);
    expect(settled).toBe(5);
  });

  it('logs gibberish as tiles + null-suit ×1.0 settle', () => {
    const { events, settled } = play(newRun('x'), 'zzq'); // not a word
    expect(events.find((e) => e.kind === 'suit')).toEqual({ kind: 'suit', suit: null, mult: 1 });
    expect(events.at(-1)).toEqual({ kind: 'settle', chips: 30, mult: 1, total: 30 });
    expect(settled).toBe(30);
  });
});
