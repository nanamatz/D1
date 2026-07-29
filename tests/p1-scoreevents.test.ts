import { describe, expect, it } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Letter, ScoreEvent, Tile } from '../src/engine/types';

const lex = makeLexicon([], { cat: { suit: 'standard', pos: ['noun'] } });
let id = 0;
const tilesFor = (word: string): Tile[] => [...word.toUpperCase()].map((letter) => ({
  id: `event-${id++}`,
  letter: letter as Letter,
  case: 'upper',
  material: 'ceramic',
  font: 'medium',
}));

const play = (word: string): { events: ScoreEvent[]; settled: number } => {
  const run = newRun(`events-${word}`);
  const hand = tilesFor(word);
  const result = submitWord(
    { ...startBlind(run, makeRng(run.seed)), hand },
    run,
    lex,
    hand.map((tile) => tile.id),
    makeRng('events'),
  );
  return { events: result.events, settled: result.submission.settledScore };
};

describe('per-submission ScoreEvent log', () => {
  it('emits tile chips in spelling order', () => {
    const tiles = play('cat').events.filter((event) => event.kind === 'tile');
    expect(tiles.map((event) => event.kind === 'tile' ? [event.letter, event.chips] : null))
      .toEqual([['C', 9], ['A', 3], ['T', 3]]);
  });

  it('emits suit before tiles', () => {
    const { events } = play('cat');
    expect(events.find((event) => event.kind === 'suit'))
      .toEqual({ kind: 'suit', suit: 'standard', mult: 1 });
    expect(events.findIndex((event) => event.kind === 'suit'))
      .toBeLessThan(events.findIndex((event) => event.kind === 'tile'));
  });

  it('ends with the settled total', () => {
    expect(play('cat').events.at(-1))
      .toEqual({ kind: 'settle', chips: 15, mult: 1, total: 15 });
  });

  it('omits Emoji Tile events when none are owned', () => {
    const { events } = play('cat');
    expect(events.some((event) => event.kind === 'joker')).toBe(false);
  });

  it('logs gibberish with null suit and ×1 Mult', () => {
    const { events, settled } = play('zzq');
    expect(events.find((event) => event.kind === 'suit'))
      .toEqual({ kind: 'suit', suit: null, mult: 1 });
    expect(events.at(-1)).toEqual({ kind: 'settle', chips: 90, mult: 1, total: 90 });
    expect(settled).toBe(90);
  });
});
