import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { JokerBus } from '../src/engine/events';
import {
  ALL_JOKERS,
  DEVELOPER_GRACE_ID,
  JOKER_REGISTRY,
  createOwnedJoker,
} from '../src/engine/jokers';
import { discardTiles, startBlind } from '../src/engine/loop';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { buyItem, prepareShop, rerollShop } from '../src/engine/shop';
import type {
  BlindState,
  Letter,
  RunState,
  Tile,
  WordScoringContext,
  WordSubmission,
} from '../src/engine/types';
import { jokerArt } from '../src/ui/jokerArt';

const bus = new JokerBus(JOKER_REGISTRY);
let serial = 0;

const tilesFor = (text: string): Tile[] => [...text.toUpperCase()].map((letter) => ({
  id: `requested-${serial++}`,
  letter: letter as Letter,
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
}));

const submission = (text: string, isGibberish = false): WordSubmission => ({
  text: text.toLowerCase(),
  suit: isGibberish ? null : 'standard',
  isGibberish,
  posUsed: null,
  settledScore: 0,
  tiles: tilesFor(text),
});

const context = (word: WordSubmission): WordScoringContext => ({
  submission: word,
  chips: 0,
  mult: 1,
  baseSuit: word.suit,
  scoringSuits: new Set(word.suit ? [word.suit] : []),
  scoreBonus: 0,
});

const runWith = (id: string): RunState => {
  const run = newRun(`requested-${id}`);
  run.jokers = [createOwnedJoker(run, id)];
  return run;
};

const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: () => value,
  shuffle: <T,>(items: readonly T[]) => [...items],
});

describe('requested Emoji Tile mechanics', () => {
  it('Strawberry Jam multiplies a Word Hand already played in the blind', () => {
    const run = runWith('strawberryJam');
    const blind = {
      ...startBlind(run, makeRng('jam')),
      sequence: [submission('AAB')],
    };
    const ctx = context(submission('CCD'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(BALANCE.jokers.strawberryJam.factor);
  });

  it('Biochemistry grows by ×0.5 for consecutive repeats of a most-played hand', () => {
    const run = runWith('biochemistry');
    run.letterHandPlayCounts = { twin: 4 };
    const firstBlind = {
      ...startBlind(run, makeRng('biochemistry')),
      sequence: [submission('AAB')],
    };
    const first = context(submission('CCD'));
    bus.emit('wordScoring', { run, blind: firstBlind, ctx: first }, run.jokers);
    expect(first.mult).toBe(1.5);
    expect(run.jokers[0]!.state.factor).toBe(1.5);

    const second = context(submission('EEF'));
    bus.emit('wordScoring', {
      run,
      blind: { ...firstBlind, sequence: [...firstBlind.sequence, first.submission] },
      ctx: second,
    }, run.jokers);
    expect(second.mult).toBe(2);
    expect(run.jokers[0]!.state.factor).toBe(2);
  });

  it('Bald chooses a seeded letter each blind and multiplies every matching scored tile', () => {
    const run = runWith('bald');
    const blind = startBlind(run, makeRng('bald'));
    const triggers: import('../src/engine/events').BlindSelectedJokerTrigger[] = [];
    bus.emit('blindSelected', {
      run,
      blind,
      rng: fixedRng(0),
      createdTiles: [],
      triggers,
    }, run.jokers);
    expect(run.jokers[0]!.state.letterCode).toBe('A'.charCodeAt(0));
    const ctx = context(submission('AAA'));
    for (const tile of ctx.submission.tiles) {
      bus.emit('tileScoring', { run, blind, ctx, tile }, run.jokers);
    }
    expect(ctx.mult).toBe(BALANCE.jokers.bald.factor ** 3);
  });

  it.each([
    ['ambidextrous', 'AAA', false, BALANCE.jokers.ambidextrous.factor],
    ['thirdParty', 'AAA', false, BALANCE.jokers.thirdParty.factor],
    ['mirrorImage', 'ABCBA', false, BALANCE.jokers.mirrorImage.factor],
    ['gathering', 'AEIOU', true, BALANCE.jokers.gathering.factor],
    ['straightTalk', 'ABCDE', true, BALANCE.jokers.straightTalk.factor],
  ] as const)('%s recognizes its contained Word Hand', (id, text, gibberish, factor) => {
    const run = runWith(id);
    const blind = startBlind(run, makeRng(id));
    const ctx = context(submission(text, gibberish));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(factor);
  });

  it('Zombie moves played tiles from the blind discard pile back to its pouch', () => {
    const run = runWith('zombie');
    const blind = startBlind(run, makeRng('zombie'));
    const played = submission('CAT').tiles;
    const untouched = tilesFor('Z')[0]!;
    blind.discardedThisBlind = [...played, untouched];
    const before = blind.bag.length;
    bus.emit('tilesPlayed', { run, blind, tiles: played }, run.jokers);
    expect(blind.bag).toHaveLength(before + played.length);
    expect(blind.bag.slice(-played.length).map((tile) => tile.id))
      .toEqual(played.map((tile) => tile.id));
    expect(blind.discardedThisBlind).toEqual([untouched]);
  });

  it('The Scarlet Letter counts physical discarded A tiles and includes earlier discards', () => {
    const run = newRun('scarlet-letter');
    const blind = startBlind(run, makeRng('scarlet-letter'));
    const selected = tilesFor('AAB');
    const discarded = discardTiles(
      { ...blind, hand: [...selected, ...blind.hand.slice(3)] },
      run,
      selected.map((tile) => tile.id),
      makeRng('scarlet-letter-discard'),
    );
    expect(discarded.discardedLetterCounts).toMatchObject({ A: 2, B: 1 });

    const lateRun = {
      ...run,
      discardedLetterCounts: discarded.discardedLetterCounts,
    };
    lateRun.jokers = [createOwnedJoker(lateRun, 'scarletLetter')];
    const ctx = context(submission('CAT'));
    bus.emit('wordScoring', { run: lateRun, blind: discarded.blind, ctx }, lateRun.jokers);
    expect(ctx.mult).toBeCloseTo(1.2);
    expect(lateRun.jokers[0]!.state.factor).toBeCloseTo(1.2);
  });
});

describe("Developer's Grace", () => {
  it('is pinned in the first development shop, survives rerolls, and never enters public stock', () => {
    const run = { ...newRun('developer-shop'), gold: 100 };
    const prepared = prepareShop(run, makeRng('developer-shop'), new Set(), undefined, true);
    expect(prepared.shop.items[0]).toMatchObject({
      kind: 'joker',
      id: DEVELOPER_GRACE_ID,
      price: 0,
      developerPinned: true,
    });
    const rerolled = rerollShop(prepared.run, prepared.shop, makeRng('developer-reroll'));
    expect(rerolled.shop.items).toHaveLength(prepared.shop.items.length);
    expect(rerolled.shop.items).toContainEqual(expect.objectContaining({
      kind: 'joker', id: DEVELOPER_GRACE_ID, developerPinned: true,
    }));
    const bought = buyItem(prepared.run, prepared.shop, 0, new Set([DEVELOPER_GRACE_ID]));
    expect(bought.ok).toBe(true);
    expect(bought.run.jokers).toContainEqual(expect.objectContaining({
      defId: DEVELOPER_GRACE_ID,
    }));
    expect(prepareShop(run, makeRng('production-shop')).shop.items)
      .not.toContainEqual(expect.objectContaining({ kind: 'joker', id: DEVELOPER_GRACE_ID }));
    expect(prepareShop(prepared.run, makeRng('second-dev-shop'), new Set(), undefined, true).shop.items)
      .not.toContainEqual(expect.objectContaining({ kind: 'joker', id: DEVELOPER_GRACE_ID }));
    expect(ALL_JOKERS.some((def) => def.id === DEVELOPER_GRACE_ID)).toBe(false);
  });

  it('sets the blind target to 1 and has a registered 84×112 Primordial master', () => {
    const run = runWith(DEVELOPER_GRACE_ID);
    expect(startBlind(run, makeRng('developer-target')).target).toBe(1);
    expect(JOKER_REGISTRY.get(DEVELOPER_GRACE_ID)?.rarity).toBe('primordial');
    expect(jokerArt(DEVELOPER_GRACE_ID)).toMatch(/\.png$/);
    const png = readFileSync(
      new URL('../src/ui/assets/jokers/developer-grace.png', import.meta.url),
    );
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([84, 112]);
  });
});
