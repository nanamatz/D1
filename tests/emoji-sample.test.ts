import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BALANCE } from '../src/engine/balance';
import { JokerBus } from '../src/engine/events';
import {
  ALL_JOKERS,
  JOKER_REGISTRY,
  onBlindEnded,
  onConstellationUsed,
  onTilesDestroyed,
} from '../src/engine/jokers';
import { startBlind } from '../src/engine/loop';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type {
  ChanceResult,
  Letter,
  OwnedJoker,
  RunState,
  SentenceScoringContext,
  Suit,
  Tile,
  WordScoringContext,
  WordSubmission,
} from '../src/engine/types';
import { emojiTileShopPrice, jokerSlotLimit } from '../src/engine/vouchers';
import { jokerArt } from '../src/ui/jokerArt';

const bus = new JokerBus(JOKER_REGISTRY);
let tileId = 0;

const submission = (
  text: string,
  suit: Suit | null = 'standard',
  isGibberish = false,
  settledScore = 0,
): WordSubmission => ({
  text,
  suit,
  isGibberish,
  posUsed: null,
  settledScore,
  tiles: [...text.toUpperCase()].map((letter) => ({
    id: `sample-${tileId++}`,
    letter: letter as Letter,
    material: 'ceramic',
    font: 'medium',
  } satisfies Tile)),
});

const owned = (...defIds: string[]): OwnedJoker[] =>
  defIds.map((defId) => ({ defId, state: {} }));

const runWith = (...defIds: string[]): RunState => {
  const run = newRun('emoji-sample');
  run.jokers = owned(...defIds);
  return run;
};

const ctxFor = (word: WordSubmission): WordScoringContext => ({
  submission: word,
  chips: 10,
  mult: 1,
  baseSuit: word.suit,
  scoringSuits: new Set(word.suit ? [word.suit] : []),
  scoreBonus: 0,
});

const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: () => value,
  shuffle: <T,>(items: readonly T[]) => [...items],
});

describe('Emoji Tile sample 10 — mechanics', () => {
  it('Carte Blanche discounts Emoji Tile shop prices without adding a slot', () => {
    const run = runWith('carteBlanche');
    expect(jokerSlotLimit(run)).toBe(BALANCE.jokerSlots);
    expect(emojiTileShopPrice(run, 7)).toBe(7 - BALANCE.jokers.carteBlanche.shopDiscount);
  });

  it('Hypocrite doubles only a mixed Formal/Vulgar sentence bonus', () => {
    const run = runWith('hypocrite');
    const blind = startBlind(run, makeRng('hypocrite'));
    const ctx: SentenceScoringContext = {
      sequence: [submission('edict', 'formal'), submission('damn', 'vulgar')],
      match: null,
      unison: null,
      totalBefore: 0,
      sentenceChips: 20,
      sentenceMult: 3,
    };
    bus.emit('sentenceScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.sentenceMult).toBe(3 * BALANCE.jokers.hypocrite.factor);
  });

  it('Rhyme Chain compounds its streak on matching endings and resets on a miss', () => {
    const run = runWith('rhymeChain');
    let blind = startBlind(run, makeRng('rhyme'));
    blind = { ...blind, sequence: [submission('cat', 'standard', false, 15)] };
    const matching = ctxFor(submission('bat'));
    bus.emit('wordScoring', { run, blind, ctx: matching }, run.jokers);
    expect(matching.mult).toBe(BALANCE.jokers.rhymeChain.factorPerMatch);
    expect(run.jokers[0]?.state.factor).toBe(BALANCE.jokers.rhymeChain.factorPerMatch);

    blind = { ...blind, sequence: [submission('bat', 'standard', false, 15)] };
    const miss = ctxFor(submission('dog'));
    bus.emit('wordScoring', { run, blind, ctx: miss }, run.jokers);
    expect(miss.mult).toBe(1);
    expect(run.jokers[0]?.state.factor).toBe(1);
    run.jokers[0]!.state.factor = 3.375;
    expect(onBlindEnded(run, blind, fixedRng(1)).jokers[0]?.state.factor).toBe(1);
  });

  it('Astronomer grows when a Constellation card is used', () => {
    const run = onConstellationUsed(runWith('stargazer'));
    expect(run.jokers[0]?.state.factor).toBe(1 + BALANCE.jokers.stargazer.factorPerCard);
    const blind = startBlind(run, makeRng('stars'));
    const ctx = ctxFor(submission('cat'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBeCloseTo(1 + BALANCE.jokers.stargazer.factorPerCard);
  });

  it('Dadaist gives a gibberish hole the effective Slang register', () => {
    const run = runWith('dadaist');
    const blind = startBlind(run, makeRng('dada'));
    const ctx = ctxFor(submission('zzq', null, true));
    bus.emit('wordRules', { run, blind, ctx }, run.jokers);
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.scoringSuits?.has('slang')).toBe(true);
    expect(ctx.mult).toBe(BALANCE.jokers.dadaist.factor);
    expect(ctx.submission.suit).toBeNull();
  });

  it('Rotary Press replays earlier settled word scores on the last phase', () => {
    const run = runWith('rotaryPress');
    const blind = {
      ...startBlind(run, makeRng('press')),
      phasesUsed: 4,
      phasesTotal: 5,
      sequence: [
        submission('cat', 'standard', false, 15),
        submission('run', 'standard', false, 9),
      ],
    };
    const ctx = ctxFor(submission('ink'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.scoreBonus).toBe(24);
  });

  it('Book of Margins adds three slots and doubles per empty effective slot', () => {
    const run = runWith('bookOfMargins');
    const blind = startBlind(run, makeRng('margins'));
    const ctx = ctxFor(submission('space'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(jokerSlotLimit(run)).toBe(8);
    expect(ctx.mult).toBe(128); // seven empty effective slots
  });

  it('Type Foundry compounds once per destroyed tile', () => {
    const run = onTilesDestroyed(runWith('typeFoundry'), 2);
    expect(run.jokers[0]?.state.factor).toBe(2.25);
  });

  it('Scrap Dealer adds Mult for Brass tiles in the permanent pouch', () => {
    const run = runWith('scrapDealer');
    run.bag = run.bag.map((tile, index) => index < 2 ? { ...tile, material: 'brass' } : tile);
    const blind = startBlind(run, makeRng('scrap-brass'));
    const ctx = ctxFor(submission('metal'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(1 + 2 * BALANCE.jokers.scrapDealer.factorPerBrass);
    expect(run.jokers[0]?.state.mult).toBeUndefined();
  });

  it('Tower of Babel makes valid words members of all four final registers', () => {
    const run = runWith('towerOfBabel');
    const blind = startBlind(run, makeRng('babel'));
    const ctx = ctxFor(submission('plain', 'standard'));
    bus.emit('wordRules', { run, blind, ctx }, run.jokers);
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect([...ctx.scoringSuits ?? []].sort()).toEqual(
      ['formal', 'slang', 'standard', 'vulgar'],
    );
    expect(ctx.mult).toBe(1);
    expect(ctx.submission.suit).toBe('standard');
  });

  it('Misbound grows on survival and removes itself on the seeded failure', () => {
    const run = runWith('misbound');
    const blind = startBlind(run, makeRng('misbound'));
    const survivedResults: ChanceResult[] = [];
    const survived = onBlindEnded(run, blind, fixedRng(1), survivedResults);
    expect(survived.jokers[0]?.state.factor).toBe(1.5);
    expect(survivedResults[0]).toMatchObject({ sourceId: 'misbound', outcome: 'survived' });
    const destroyedResults: ChanceResult[] = [];
    expect(onBlindEnded(survived, blind, fixedRng(0), destroyedResults).jokers).toHaveLength(0);
    expect(destroyedResults[0]).toMatchObject({ sourceId: 'misbound', outcome: 'destroyed' });
  });
});

describe('Emoji Tile shared art', () => {
  it('has one 84x112 source registered for every roster entry', () => {
    for (const { id } of ALL_JOKERS) {
      const file = `${id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.png`;
      expect(jokerArt(id)).toMatch(/\.png$/);
      const png = readFileSync(new URL(`../src/ui/assets/jokers/${file}`, import.meta.url));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([84, 112]);
    }
  });

  it('fully removes the retired six-tile proof set', () => {
    for (const id of [
      'jackOfAllTrades',
      'vowelPraise',
      'consonantBricklayer',
      'hipster',
      'grammarian',
      'rushSpecialist',
    ]) {
      expect(JOKER_REGISTRY.has(id)).toBe(false);
    }
  });
});
