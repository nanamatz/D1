import { describe, expect, it } from 'vitest';
import { ALL_JOKERS, createOwnedJoker, onTilesCreated, onTilesDestroyed, onTilesEnhanced } from '../src/engine/jokers';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeLexicon } from '../src/engine/lexicon';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { BlindState, Letter, RunState, Tile } from '../src/engine/types';
import { JOKER_TRIGGER_SEMANTICS } from './fixtures/joker-trigger-semantics';

let serial = 0;
const tiles = (word: string): Tile[] => [...word].map((letter) => ({
  id: `unit-${serial++}`,
  letter: letter as Letter,
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
}));
const lex = makeLexicon([], Object.fromEntries(
  ['cat', 'abc', 'abxde', 'ba'].map((word) => [word, { suit: 'standard', pos: ['noun'] }]),
));
const runWith = (id: string): RunState => {
  const run = newRun(`unit-${id}`);
  run.jokers = [createOwnedJoker(run, id)];
  return run;
};
const play = (blind: BlindState, run: RunState, word: string) => {
  const hand = tiles(word.toUpperCase());
  return submitWord(
    { ...blind, hand }, run, lex, hand.map((tile) => tile.id), makeRng(`unit-play-${serial}`),
  );
};
const beats = (result: ReturnType<typeof play>, id: string) => result.events.filter(
  (event) => event.kind === 'joker' && event.jokerId === id,
);

describe('per-qualifying-unit Emoji Tile events', () => {
  it('classifies every public Emoji Tile exactly once', () => {
    const classified = Object.values(JOKER_TRIGGER_SEMANTICS).flat();
    expect(classified).toHaveLength(150);
    expect(new Set(classified).size).toBe(150);
    expect([...classified].sort()).toEqual(ALL_JOKERS.map((def) => def.id).sort());
    expect(Object.fromEntries(Object.entries(JOKER_TRIGGER_SEMANTICS).map(
      ([kind, ids]) => [kind, ids.length],
    ))).toEqual({
      atomicImmediate: 51,
      storedGrowthApplyOnce: 36,
      booleanOrAggregate: 54,
      noTriggerRulePassive: 9,
    });
  });

  it('Gematria emits 1, 2, then 3 independent +15 events for CAT', () => {
    let run = runWith('gematria');
    let blind = startBlind(run, makeRng('unit-gematria'), { target: 1_000_000 });
    for (const count of [1, 2, 3]) {
      const result = play(blind, run, 'cat');
      const events = beats(result, 'gematria');
      expect(events).toHaveLength(count);
      expect(events.every((event) => event.kind === 'joker' && event.multDelta === 15)).toBe(true);
      blind = result.blind;
      run = { ...run, jokers: result.jokers };
    }
  });

  it.each([
    ['abc', 3],
    ['abxde', 4],
    ['ba', 0],
  ])('Alphabet Press emits one beat per participating letter in %s', (word, expected) => {
    const run = runWith('alphabetPress');
    const result = play(startBlind(run, makeRng(`unit-${word}`)), run, word);
    const events = beats(result, 'alphabetPress');
    expect(events).toHaveLength(expected);
    expect(events.every((event) => event.kind === 'joker' && event.multFactor === 1.5)).toBe(true);
  });

  it('Type Orchestra includes Medium and fires once per distinct font', () => {
    const run = runWith('typeOrchestra');
    const hand = tiles('CAT');
    hand[1]!.font = 'lightItalic';
    hand[2]!.font = 'bold';
    const result = submitWord(
      { ...startBlind(run, makeRng('unit-orchestra')), hand }, run, lex,
      hand.map((tile) => tile.id), makeRng('unit-orchestra-play'),
    );
    expect(beats(result, 'typeOrchestra')).toHaveLength(3);
  });

  it('Type Orchestra repeats the eligible font-unit effect on a Black retrigger', () => {
    const run = runWith('typeOrchestra');
    const hand = tiles('CAT');
    hand[1]!.font = 'black';
    hand[2]!.font = 'bold';
    const result = submitWord(
      { ...startBlind(run, makeRng('unit-orchestra-retrigger')), hand }, run, lex,
      hand.map((tile) => tile.id), makeRng('unit-orchestra-retrigger-play'),
    );
    expect(beats(result, 'typeOrchestra')).toHaveLength(4);
  });

  it('Growth Rings emits one tile beat per 15 Wood stacks', () => {
    const run = runWith('growthRings');
    const hand = tiles('CAT');
    hand[0]!.material = 'wood';
    hand[0]!.woodBonusChips = 30;
    const result = submitWord(
      { ...startBlind(run, makeRng('unit-rings')), hand }, run, lex,
      hand.map((tile) => tile.id), makeRng('unit-rings-play'),
    );
    expect(beats(result, 'growthRings')).toHaveLength(2);
  });

  it('logs created, destroyed, and enhanced lifecycle growth in natural unit order', () => {
    const run = newRun('unit-lifecycle');
    run.jokers = [
      createOwnedJoker(run, 'livingType'),
      { ...createOwnedJoker(run, 'termInsurance'), instanceId: 2 },
      { ...createOwnedJoker(run, 'typeFoundry'), instanceId: 3 },
      { ...createOwnedJoker(run, 'blacksmith'), instanceId: 4 },
    ];
    const created = onTilesCreated(run, 2);
    const destroyed = onTilesDestroyed(created, 2);
    const enhanced = onTilesEnhanced(destroyed, 2);
    const events = enhanced.lifecycleGrowthEvents ?? [];
    expect(events.map((event) => [event.jokerId, Number(event.delta.toFixed(10))])).toEqual([
      ['livingType', 15], ['livingType', 15],
      ['termInsurance', 0.2], ['typeFoundry', 0.5],
      ['termInsurance', 0.2], ['typeFoundry', 0.75],
      ['blacksmith', 10], ['blacksmith', 10],
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
