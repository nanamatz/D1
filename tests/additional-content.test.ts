import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { emojiTileSellValue } from '../src/engine/economy';
import { JokerBus } from '../src/engine/events';
import { JOKER_REGISTRY, onBlindEnded } from '../src/engine/jokers';
import { noiseCancellingFactor } from '../src/engine/jokers/noiseCancelling';
import { discardTiles, enterJokerBlind, startBlind, submitWord } from '../src/engine/loop';
import { makeLexicon } from '../src/engine/lexicon';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Letter, OwnedJoker, Tile, WordScoringContext, WordSubmission } from '../src/engine/types';

const bus = new JokerBus(JOKER_REGISTRY);
const lex = makeLexicon(['a'], {});
const owned = (defId: string): OwnedJoker => ({ defId, edition: 'base', state: {} });
const tile = (id: string, letter: Letter): Tile => ({
  id, letter, material: 'ceramic', font: 'medium', edition: 'base',
});
const submission = (tiles: Tile[]): WordSubmission => ({
  text: tiles.map((entry) => entry.letter).join(''),
  tiles,
  isGibberish: false,
  suit: 'standard',
  posUsed: null,
  settledScore: 0,
});
const ctx = (tiles: Tile[]): WordScoringContext => ({
  submission: submission(tiles),
  chips: 0,
  mult: 1,
  scoringSuits: new Set(['standard']),
  scoringVowels: new Set(['A', 'E', 'I', 'O', 'U']),
  tileRetriggers: new Map(),
  scoreBonus: 0,
});

describe('2026-08-05 additional content', () => {
  it('Cleaning Sign charges $2 per discard without taking gold below zero', () => {
    const run = newRun('cleaning-sign');
    run.gold = 1;
    const blind = startBlind(run, makeRng('cleaning-sign'), {
      kind: 'boss',
      bossId: 'cleaningSign',
    });
    const result = discardTiles(blind, run, [blind.hand[0]!.id], makeRng('cleaning-sign-discard'));
    expect(result.goldDelta).toBe(-1);
  });

  it('Counterfeit copies exactly one tile on the first play into hand and permanent output', () => {
    const run = newRun('counterfeit');
    run.jokers = [owned('counterfeit'), owned('livingType')];
    const started = startBlind(run, makeRng('counterfeit'));
    const source = tile('counterfeit-source', 'A');
    const blind = { ...started, hand: [source, ...started.hand.slice(1)] };
    const first = submitWord(blind, run, lex, [source.id], makeRng('counterfeit-first'));

    expect(first.createdTiles).toHaveLength(BALANCE.jokers.counterfeit.copies);
    expect(first.createdTiles[0]).toMatchObject({ letter: 'A', material: 'ceramic', font: 'medium' });
    expect(first.createdTiles[0]!.id).not.toBe(source.id);
    expect(first.blind.hand.some((entry) => entry.id === first.createdTiles[0]!.id)).toBe(true);
    expect(first.jokers[1]!.state.chips).toBe(BALANCE.jokers.livingType.chipsPerTile);

    const nextTile = first.blind.hand[0]!;
    const second = submitWord(first.blind, { ...run, jokers: first.jokers }, lex, [nextTile.id], makeRng('counterfeit-second'));
    expect(second.createdTiles).toEqual([]);
  });

  it('25th Blessing multiplies once per held Y and excludes a played Y', () => {
    const run = newRun('blessing');
    run.jokers = [owned('twentyFifthBlessing')];
    const played = tile('played-y', 'Y');
    const heldA = tile('held-y-a', 'Y');
    const heldB = tile('held-y-b', 'Y');
    const blind = { ...startBlind(run, makeRng('blessing')), hand: [played, heldA, heldB] };
    const scoring = ctx([played]);
    bus.emit('heldTileScoring', { run, blind, ctx: scoring, tile: heldA }, run.jokers);
    bus.emit('heldTileScoring', { run, blind, ctx: scoring, tile: heldB }, run.jokers);
    expect(scoring.mult).toBe(BALANCE.jokers.twentyFifthBlessing.factorPerHeldY ** 2);
  });

  it('Blood Type A adds chips for scored A and O tiles only', () => {
    const run = newRun('blood-type-a');
    run.jokers = [owned('bloodTypeA')];
    const blind = startBlind(run, makeRng('blood-type-a'));
    const scoring = ctx([]);
    for (const entry of [tile('a', 'A'), tile('o', 'O'), tile('b', 'B')]) {
      bus.emit('tileScoring', { run, blind, ctx: scoring, tile: entry }, run.jokers);
    }
    expect(scoring.chips).toBe(BALANCE.jokers.bloodTypeA.chipsPerLetter * 2);
  });

  it('Noise Cancelling scales from the run-wide skipped-blind count', () => {
    const run = newRun('noise-cancelling');
    run.skippedBlinds = 3;
    run.jokers = [owned('noiseCancelling')];
    const blind = startBlind(run, makeRng('noise-cancelling'));
    const scoring = ctx([]);
    bus.emit('wordScoring', { run, blind, ctx: scoring }, run.jokers);
    expect(scoring.mult).toBe(noiseCancellingFactor(run.skippedBlinds));
    expect(run.jokers[0]!.state.factor).toBe(noiseCancellingFactor(run.skippedBlinds));
  });

  it('Three-Leaf Clover grows its sell value by $3 at each blind end', () => {
    const run = newRun('three-leaf-clover');
    run.jokers = [owned('threeLeafClover')];
    const blind = startBlind(run, makeRng('three-leaf-clover'));
    const next = onBlindEnded(run, blind, makeRng('three-leaf-clover-end'));
    const bonus = next.jokers[0]!.state.sellBonus!;
    expect(bonus).toBe(BALANCE.jokers.threeLeafClover.sellValuePerBlind);
    expect(emojiTileSellValue(next, BALANCE.jokerPrice.common, 'base', bonus))
      .toBe(emojiTileSellValue(next, BALANCE.jokerPrice.common) + bonus);
  });

  it('Medusa petrifies two held tiles after play and blocks Stone discards', () => {
    const run = newRun('medusa');
    const blind = startBlind(run, makeRng('medusa'), {
      kind: 'boss', bossId: 'medusa', target: 999_999,
    });
    const result = submitWord(blind, run, lex, [blind.hand[0]!.id], makeRng('medusa-play'));
    const stones = result.blind.hand.filter((entry) => entry.material === 'stone');
    expect(stones).toHaveLength(BALANCE.boss.medusaStoneTiles);
    expect(() => discardTiles(result.blind, run, [stones[0]!.id], makeRng('medusa-discard')))
      .toThrow('boss: this tile cannot be discarded');
  });

  it('Megalith adds one permanent Stone when Blind Select is confirmed', () => {
    const run = newRun('megalith');
    run.jokers = [owned('megalith')];
    const blind = startBlind(run, makeRng('megalith-start'));
    const entered = enterJokerBlind(run, blind, makeRng('megalith-enter'));
    expect(entered.run.bag).toHaveLength(run.bag.length + 1);
    expect(entered.createdTiles).toHaveLength(1);
    expect(entered.createdTiles[0]).toMatchObject({ material: 'stone', letter: null });
    expect(entered.blind.bag.some((entry) => entry.id === entered.createdTiles[0]!.id)).toBe(true);
  });

  it('Host destroys its left Emoji Tile and gains twice its sell value as Mult', () => {
    const run = newRun('host');
    run.jokers = [owned('miser'), owned('host')];
    const blind = startBlind(run, makeRng('host-start'));
    const expected = emojiTileSellValue(run, BALANCE.jokerPrice.common)
      * BALANCE.jokers.host.multPerSellValue;
    const entered = enterJokerBlind(run, blind, makeRng('host-enter'));
    expect(entered.run.jokers.map((joker) => joker.defId)).toEqual(['host']);
    expect(entered.run.jokers[0]!.state.mult).toBe(expected);
    const scoring = ctx([tile('host-a', 'A')]);
    bus.emit('wordScoring', { run: entered.run, blind: entered.blind, ctx: scoring }, entered.run.jokers);
    expect(scoring.mult).toBe(1 + expected);
  });

  it('Astronomer grows by ×0.1 per used Constellation card', () => {
    const run = newRun('astronomer');
    run.jokers = [owned('stargazer')];
    bus.emit('constellationUsed', { run }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBe(1 + BALANCE.jokers.stargazer.factorPerCard);
  });

  it('Dummy Data adds two to effective scoring length', () => {
    const run = newRun('dummy-data');
    run.jokers = [owned('dummyData')];
    const played = tile('dummy-a', 'A');
    const blind = { ...startBlind(run, makeRng('dummy-data')), hand: [played] };
    const result = submitWord(blind, run, lex, [played.id], makeRng('dummy-data-play'));
    expect(result.submission.scoringLength).toBe(3);
    expect(result.events).toContainEqual(expect.objectContaining({ kind: 'wordLength', letters: 3 }));
  });
});
