import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { emojiTileSellValue } from '../src/engine/economy';
import { JokerBus } from '../src/engine/events';
import { useFable } from '../src/engine/fables';
import { createOwnedJoker, JOKER_REGISTRY } from '../src/engine/jokers';
import { discardTiles, startBlind } from '../src/engine/loop';
import { resolveBlind } from '../src/engine/progression';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { rerollShop, rollShopStock } from '../src/engine/shop';
import type {
  Letter,
  OwnedJoker,
  RunState,
  Tile,
  WordScoringContext,
  WordSubmission,
} from '../src/engine/types';

const bus = new JokerBus(JOKER_REGISTRY);
const owned = (run: RunState, defId: string): OwnedJoker => createOwnedJoker(run, defId);
const tile = (id: string, letter: Letter, material: Tile['material'] = 'ceramic'): Tile => ({
  id, letter, material, font: 'medium', edition: 'base',
});
const scoring = (tiles: Tile[]): WordScoringContext => {
  const submission: WordSubmission = {
    text: tiles.map((entry) => entry.letter ?? '').join(''),
    tiles,
    isGibberish: false,
    suit: 'standard',
    posUsed: null,
    settledScore: 0,
  };
  return {
    submission,
    chips: 0,
    mult: 1,
    baseSuit: 'standard',
    scoringSuits: new Set(['standard']),
    scoringVowels: new Set(['A', 'E', 'I', 'O', 'U']),
    tileRetriggers: new Map(),
    scoreBonus: 0,
  };
};

describe('2026-08-12 requested Emoji Tiles', () => {
  it('Shuriken loses ×0.01 per discarded tile and applies the remaining factor', () => {
    const run = newRun('shuriken');
    run.jokers = [owned(run, 'shuriken')];
    const blind = startBlind(run, makeRng('shuriken'));
    bus.emit('tilesDiscarded', {
      run, blind, tiles: [tile('discard-a', 'A'), tile('discard-b', 'B')],
    }, run.jokers);
    const ctx = scoring([tile('score-a', 'A')]);
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBeCloseTo(1.98);
    expect(ctx.mult).toBeCloseTo(1.98);
  });

  it('Earthquake retriggers every played tile for exactly ten hands', () => {
    const run = newRun('earthquake');
    run.jokers = [owned(run, 'earthquake')];
    const blind = startBlind(run, makeRng('earthquake'));
    for (let hand = 0; hand < BALANCE.jokers.earthquake.hands + 1; hand += 1) {
      const tiles = [tile(`quake-${hand}-a`, 'A'), tile(`quake-${hand}-b`, 'B')];
      const ctx = scoring(tiles);
      bus.emit('wordRules', { run, blind, ctx }, run.jokers);
      const expected = hand < BALANCE.jokers.earthquake.hands ? ['earthquake'] : undefined;
      for (const entry of tiles) expect(ctx.tileRetriggers?.get(entry.id)).toEqual(expected);
      bus.emit('wordScored', { run, blind, index: hand }, run.jokers);
    }
    expect(run.jokers[0]!.state.handsRemaining).toBe(0);
  });

  it('Dog Food grows by +2 Mult after each paid shop reroll', () => {
    const run = newRun('dog-food');
    run.gold = 100;
    run.jokers = [owned(run, 'dogFood')];
    const shop = rollShopStock(run, makeRng('dog-food-stock'));
    const result = rerollShop(run, shop, makeRng('dog-food-reroll'));
    expect(result.ok).toBe(true);
    expect(result.run.jokers[0]!.state.mult).toBe(BALANCE.jokers.dogFood.multPerReroll);
    const blind = startBlind(result.run, makeRng('dog-food-blind'));
    const ctx = scoring([tile('dog-food-a', 'A')]);
    bus.emit('wordScoring', { run: result.run, blind, ctx }, result.run.jokers);
    expect(ctx.mult).toBe(1 + BALANCE.jokers.dogFood.multPerReroll);
  });

  it('Delisting destroys only a one-tile first discard and awards $3', () => {
    const run = newRun('delisting');
    run.jokers = [owned(run, 'delisting')];
    const blind = startBlind(run, makeRng('delisting'));
    const first = discardTiles(blind, run, [blind.hand[0]!.id], makeRng('delisting-first'));
    expect(first.destroyedTiles).toEqual([blind.hand[0]]);
    expect(first.bag).toHaveLength(run.bag.length - 1);
    expect(first.goldDelta).toBe(BALANCE.jokers.delisting.gold);

    const continuedRun = { ...run, bag: first.bag, jokers: first.jokers };
    const second = discardTiles(
      first.blind,
      continuedRun,
      [first.blind.hand[0]!.id],
      makeRng('delisting-second'),
    );
    expect(second.destroyedTiles).toEqual([]);
    expect(second.goldDelta).toBe(0);
  });

  it('Great Depression adds uncapped interest per $5 held', () => {
    const run = newRun('great-depression');
    run.gold = 30;
    run.jokers = [owned(run, 'interestGlutton'), owned(run, 'greatDepression')];
    const blind = startBlind(run, makeRng('great-depression'));
    const result = resolveBlind(run, blind, blind.target);
    expect(result.earned.interest).toBe(
      BALANCE.interest.cap
      + Math.floor(run.gold / BALANCE.jokers.greatDepression.goldPerStepHeld)
        * BALANCE.jokers.greatDepression.goldPerStep,
    );
    expect(result.run.jokers[0]!.state.mult).toBe(
      result.earned.interest * BALANCE.jokers.interestGlutton.multPerGold,
    );
  });

  it('Leak adds +4 Mult for every permanent pouch tile below 68', () => {
    const run = newRun('leak');
    run.bag = run.bag.slice(0, run.bag.length - 3);
    run.jokers = [owned(run, 'leak')];
    const blind = startBlind(run, makeRng('leak'));
    const ctx = scoring([tile('leak-a', 'A')]);
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(1 + 3 * BALANCE.jokers.leak.multPerMissingTile);
  });

  it('Peddler adds the total current Emoji Tile sell value to Mult', () => {
    const run = newRun('peddler');
    run.jokers = [owned(run, 'peddler'), owned(run, 'storyteller')];
    const blind = startBlind(run, makeRng('peddler'));
    const ctx = scoring([tile('peddler-a', 'A')]);
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    const sellTotal = run.jokers.reduce((sum, joker) => {
      const def = JOKER_REGISTRY.get(joker.defId)!;
      return sum + emojiTileSellValue(run, def.price, joker.edition, joker.state.sellBonus ?? 0);
    }, 0);
    expect(ctx.mult).toBe(1 + sellTotal);
  });

  it('Storyteller counts successful Fable uses and adds +1 Mult per use', () => {
    const run = newRun('storyteller');
    run.consumables = ['fable9'];
    run.jokers = [owned(run, 'storyteller')];
    const blind = startBlind(run, makeRng('storyteller'));
    const used = useFable('fable9', run, blind, [], makeRng('storyteller-use'));
    expect(used.ok).toBe(true);
    expect(used.run.fablesUsed).toBe(1);
    expect(used.run.jokers[0]!.state.mult).toBe(BALANCE.jokers.storyteller.multPerFable);
    const ctx = scoring([tile('storyteller-a', 'A')]);
    bus.emit('wordScoring', { run: used.run, blind: used.blind, ctx }, used.run.jokers);
    expect(ctx.mult).toBe(1 + BALANCE.jokers.storyteller.multPerFable);
  });

  it('Recycling pays $5 for each discarded assigned letter', () => {
    const run = newRun('recycling');
    run.gold = 0;
    run.jokers = [owned(run, 'recycling')];
    run.jokers[0]!.state.letterCode = 'A'.charCodeAt(0);
    const blind = startBlind(run, makeRng('recycling'));
    bus.emit('tilesDiscarded', {
      run,
      blind,
      tiles: [tile('recycle-a1', 'A'), tile('recycle-b', 'B'), tile('recycle-a2', 'A')],
    }, run.jokers);
    expect(run.gold).toBe(2 * BALANCE.jokers.recycling.goldPerTile);
  });

  it('Beehive Tile starts at +66 Chips and grows by +6 on each six-letter word', () => {
    const run = newRun('beehive-tile');
    run.jokers = [owned(run, 'beehiveTile')];
    const blind = startBlind(run, makeRng('beehive-tile'));
    const six = [...'ABCDEF'].map((letter, index) => tile(`hive-${index}`, letter as Letter));
    const first = scoring(six);
    bus.emit('wordScoring', { run, blind, ctx: first }, run.jokers);
    expect(first.chips).toBe(
      BALANCE.jokers.beehiveTile.baseChips + BALANCE.jokers.beehiveTile.chipsPerWord,
    );
    const second = scoring(six);
    bus.emit('wordScoring', { run, blind, ctx: second }, run.jokers);
    expect(second.chips).toBe(
      BALANCE.jokers.beehiveTile.baseChips + 2 * BALANCE.jokers.beehiveTile.chipsPerWord,
    );
  });

  it('Cubism gains ×0.25 when an original Lead Plate effect succeeds', () => {
    const run = newRun('cubism');
    run.jokers = [owned(run, 'cubism')];
    const blind = startBlind(run, makeRng('cubism'));
    const lead = tile('cubism-lead', 'A', 'leadPlate');
    const ctx = scoring([lead]);
    bus.emit('materialScored', {
      run, blind, ctx, tile: lead, triggerIndex: 0,
      chipsDelta: 0, multDelta: 0, goldDelta: 0, grewWood: false,
      chanceResults: [{
        sourceId: 'leadPlate', chance: 0.5, outcome: 'success', label: 'mult',
      }],
    }, run.jokers);
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBe(
      BALANCE.jokers.cubism.baseFactor + BALANCE.jokers.cubism.factorPerLeadPlate,
    );
    expect(ctx.mult).toBe(
      BALANCE.jokers.cubism.baseFactor + BALANCE.jokers.cubism.factorPerLeadPlate,
    );
  });

  it('Cubism ignores retrigger-only Lead Plate successes', () => {
    const run = newRun('cubism-retrigger-only');
    run.jokers = [owned(run, 'cubism')];
    const blind = startBlind(run, makeRng('cubism-retrigger-only'));
    const lead = tile('cubism-retrigger-lead', 'A', 'leadPlate');
    const ctx = scoring([lead]);
    bus.emit('materialScored', {
      run, blind, ctx, tile: lead, triggerIndex: 0,
      chipsDelta: 0, multDelta: 0, goldDelta: 0, grewWood: false,
      chanceResults: [{
        sourceId: 'leadPlate', chance: 0.5, outcome: 'failure', label: 'mult',
      }],
    }, run.jokers);
    bus.emit('materialScored', {
      run, blind, ctx, tile: lead, triggerIndex: 1,
      chipsDelta: 0, multDelta: 0, goldDelta: 0, grewWood: false,
      chanceResults: [{
        sourceId: 'leadPlate', chance: 0.5, outcome: 'success', label: 'mult',
      }],
    }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBe(BALANCE.jokers.cubism.baseFactor);
  });
});
