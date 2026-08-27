import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { defaultJokerBus } from '../src/engine/jokers';
import {
  addOwnedJoker,
  createOwnedJoker,
  normalizeOwnedJokerInstanceIds,
  onTilesDestroyed,
} from '../src/engine/jokers';
import { findSpellableWords } from '../src/engine/hint';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord } from '../src/engine/loop';
import { setTileMaterial } from '../src/engine/materials';
import type { Rng } from '../src/engine/rng';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { tileBaseChips } from '../src/engine/scoring';
import type { Letter, Tile } from '../src/engine/types';

let serial = 0;
const tile = (letter: Letter): Tile => ({
  id: `revision-qa-${serial++}`,
  letter,
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
});
const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: (max) => Math.min(max - 1, Math.floor(value * max)),
  shuffle: <T>(items: readonly T[]) => [...items],
});

describe('Emoji revision QA regressions', () => {
  it('Golden Type grows per Gold trigger and survives hint, Stone, clone, and save paths', () => {
    let run = newRun('revision-qa-golden');
    run = addOwnedJoker(run, 'goldenType');
    const played = { ...tile('A'), material: 'leadPlate' as const, font: 'black' as const };
    const lexicon = makeLexicon([], { a: { suit: 'standard', pos: ['noun'] } });
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand: [played] },
      run,
      lexicon,
      [played.id],
      fixedRng(0),
    );

    const updated = result.updatedTiles[0]!;
    expect(updated.bonusChips).toBe(100);
    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'goldenType',
    )).toHaveLength(2);
    expect(result.events.filter((event) => event.kind === 'tile').map((event) =>
      event.kind === 'tile' ? event.chips : 0)).toEqual([3, 53]);
    expect(played.bonusChips).toBeUndefined();

    const plain = tile('A');
    expect(findSpellableWords([plain, updated], lexicon, 1)[0]!.tileIds).toEqual([updated.id]);
    const stone = setTileMaterial(updated, 'stone');
    expect(stone.bonusChips).toBe(100);
    expect(tileBaseChips(stone)).toBe(100);
    expect({ ...updated, id: 'golden-clone' }.bonusChips).toBe(100);
    expect(JSON.parse(JSON.stringify(updated)).bonusChips).toBe(100);
  });

  it('Loaded Lead Dice adds exactly three non-recursive retriggers when both rolls fail', () => {
    let run = newRun('revision-qa-loaded');
    run = addOwnedJoker(run, 'loadedLeadDice');
    const played = { ...tile('A'), material: 'leadPlate' as const };
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand: [played] },
      run,
      makeLexicon([], { a: { suit: 'standard', pos: ['noun'] } }),
      [played.id],
      fixedRng(0.99),
    );

    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'loadedLeadDice' && event.retrigger,
    )).toHaveLength(3);
    expect(result.events.filter((event) => event.kind === 'material')).toHaveLength(4);
  });

  it('Echo keeps copied scaler state across shelf reordering and normalization', () => {
    let run = newRun('revision-qa-echo-state');
    run = addOwnedJoker(addOwnedJoker(run, 'echoChamber'), 'dogFood');
    defaultJokerBus.emit('shopRerolled', { run }, run.jokers);

    run = { ...run, jokers: [run.jokers[1]!, run.jokers[0]!] };
    defaultJokerBus.emit('shopRerolled', { run }, run.jokers);
    run = normalizeOwnedJokerInstanceIds(JSON.parse(JSON.stringify({
      ...run,
      jokers: [run.jokers[1]!, run.jokers[0]!],
    })));

    const hand = [tile('C'), tile('A'), tile('T')];
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      makeLexicon([], { cat: { suit: 'standard', pos: ['noun'] } }),
      hand.map((candidate) => candidate.id),
      makeRng('revision-qa-echo-state-play'),
    );
    const copied = result.events.find(
      (event) => event.kind === 'joker' && event.jokerId === 'echoChamber',
    );
    const physical = result.events.find(
      (event) => event.kind === 'joker' && event.jokerId === 'dogFood',
    );
    expect(copied).toMatchObject({ kind: 'joker', jokerInstanceId: 1, multDelta: 2 });
    expect(physical).toMatchObject({ kind: 'joker', jokerInstanceId: 2, multDelta: 4 });
  });

  it('Leak only grows after reaching a new maximum pouch shortage', () => {
    let run = newRun('revision-qa-leak');
    run.bag = run.bag.slice(0, 66);
    run.jokers = [createOwnedJoker(run, 'leak')];
    expect(run.jokers[0]!.state.mult).toBe(8);

    run = { ...run, bag: [...run.bag, tile('A'), tile('B')] };
    run = onTilesDestroyed({ ...run, bag: run.bag.slice(0, 66) }, 2);
    expect(run.jokers[0]!.state.mult).toBe(8);
    run = onTilesDestroyed({ ...run, bag: run.bag.slice(0, 65) }, 1);
    expect(run.jokers[0]!.state.mult).toBe(12);
    expect(run.lifecycleGrowthEvents?.at(-1)).toMatchObject({
      jokerId: 'leak',
      kind: 'multAdd',
      delta: BALANCE.jokers.leak.multPerMissingTile,
    });
  });

  it('Rotary Press authors one replay beat per prior settled word', () => {
    let run = newRun('revision-qa-rotary');
    run = addOwnedJoker(run, 'rotaryPress');
    const blind = startBlind(run, makeRng(run.seed));
    blind.phasesUsed = blind.phasesTotal - 1;
    blind.sequence = [
      { tiles: [], text: 'CAT', isGibberish: false, suit: 'standard', posUsed: 'noun', settledScore: 111 },
      { tiles: [], text: 'DOG', isGibberish: false, suit: 'standard', posUsed: 'noun', settledScore: 222 },
    ];
    const submission = {
      tiles: [tile('A')], text: 'A', isGibberish: false,
      suit: 'standard' as const, posUsed: 'noun' as const, settledScore: 0,
    };
    const ctx = { submission, chips: 0, mult: 1, scoreBonus: 0 };
    const scoreBeats: Array<{ chipsDelta: number; multDelta: number; scoreDelta?: number }> = [];
    defaultJokerBus.emit('wordScoring', { run, blind, ctx, scoreBeats }, run.jokers);
    expect(ctx.scoreBonus).toBe(333);
    expect(scoreBeats.map((beat) => beat.scoreDelta)).toEqual([111, 222]);
  });
});
