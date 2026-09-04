import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { letterChips } from '../src/engine/scoring';
import type { Letter, OwnedJoker, ScoreEvent, Tile } from '../src/engine/types';
import { settleDurationMs } from '../src/ui/settle';

const lexicon = makeLexicon([], {
  a: { suit: 'standard', pos: ['noun'] },
  cat: { suit: 'standard', pos: ['noun'] },
  damn: { suit: 'vulgar', pos: ['noun'] },
});

let serial = 0;
const tilesFor = (word: string, glass: 'first' | 'all' | 'none' = 'none'): Tile[] =>
  [...word.toUpperCase()].map((letter, index) => ({
    id: `conditional-growth-${serial++}`,
    letter: letter as Letter,
    material: glass === 'all' || (glass === 'first' && index === 0) ? 'glass' : 'ceramic',
    font: 'medium',
    edition: 'base',
  }));

const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: (max) => Math.min(max - 1, Math.floor(value * max)),
  shuffle: <T>(items: readonly T[]) => [...items],
});

const owned = (
  defId: string,
  instanceId: number,
  state: OwnedJoker['state'] = {},
): OwnedJoker => ({ defId, instanceId, edition: 'base', state });

const play = (
  run: ReturnType<typeof newRun>,
  hand: Tile[],
  rng: Rng,
  bossId?: string,
) => submitWord(
  {
    ...startBlind(run, makeRng(`${run.seed}-blind`), bossId
      ? { kind: 'boss', bossId, target: 1_000 }
      : undefined),
    hand,
  },
  run,
  lexicon,
  hand.map((tile) => tile.id),
  rng,
);

const isGrowth = (event: ScoreEvent): event is Extract<ScoreEvent, { kind: 'joker' }> =>
  event.kind === 'joker' && event.growthKind !== undefined;

describe('conditional growth presentation timing', () => {
  it('places destruction growth beside Glass while keeping its factor for later words', () => {
    const factorBefore = 1.4;
    const run = newRun('conditional-growth-later-word');
    run.jokers = [owned('termInsurance', 1, { factor: factorBefore, revision20260826: 1 })];
    const glassHand = tilesFor('CAT', 'first');
    const first = play(run, glassHand, fixedRng(0));

    const destructionIndex = first.events.findIndex((event) =>
      event.kind === 'material' &&
      event.tileId === glassHand[0]!.id &&
      event.chanceResults?.some((result) => result.outcome === 'destroyed'),
    );
    expect(destructionIndex).toBeGreaterThanOrEqual(0);
    const growthEvent = first.events[destructionIndex + 1];
    expect(growthEvent).toMatchObject({
      kind: 'joker', jokerId: 'termInsurance', jokerInstanceId: 1,
      tileId: glassHand[0]!.id, growthKind: 'mult',
    });
    expect(growthEvent?.kind === 'joker' ? growthEvent.growthDelta : Number.NaN)
      .toBeCloseTo(BALANCE.jokers.termInsurance.factorPerTile);
    expect(first.events.findIndex((event) =>
      event.kind === 'joker' && event.jokerInstanceId === 1 && event.tileId === undefined,
    )).toBeGreaterThan(destructionIndex + 1);

    const firstMult = (
      BALANCE.suitMult.standard * BALANCE.materials.glass.multFactor + glassHand.length
    ) * factorBefore;
    expect(first.submission.settledScore).toBeCloseTo(letterChips(glassHand) * firstMult);

    const nextRun = { ...run, jokers: first.jokers };
    const nextHand = tilesFor('CAT');
    const next = play(nextRun, nextHand, fixedRng(0.99));
    const factorAfter = factorBefore + BALANCE.jokers.termInsurance.factorPerTile;
    expect(next.submission.settledScore).toBeCloseTo(
      letterChips(nextHand) * (BALANCE.suitMult.standard + nextHand.length) * factorAfter,
    );
  });

  it('keeps each shattered tile atomic and attributes duplicate and Echo growth in shelf order', () => {
    const run = newRun('conditional-growth-multiple');
    run.jokers = [
      owned('termInsurance', 11, { factor: 1, revision20260826: 1 }),
      owned('echoChamber', 22),
      owned('termInsurance', 33, { factor: 1, revision20260826: 1 }),
      owned('typeFoundry', 44, { factor: 1 }),
    ];
    const hand = tilesFor('CAT', 'all');
    const result = play(run, hand, fixedRng(0));

    expect(result.destroyedTileIds).toEqual(hand.map((tile) => tile.id));
    expect(result.events.filter(isGrowth)).toHaveLength(hand.length * run.jokers.length);
    for (const [tileIndex, tile] of hand.entries()) {
      const destructionIndex = result.events.findIndex((event) =>
        event.kind === 'material' &&
        event.tileId === tile.id &&
        event.chanceResults?.some((chance) => chance.outcome === 'destroyed'),
      );
      const growth = result.events.slice(destructionIndex + 1, destructionIndex + 5);
      expect(growth.map((event) => event.kind === 'joker'
        ? [event.jokerId, event.jokerInstanceId, event.tileId]
        : null)).toEqual([
        ['termInsurance', 11, tile.id],
        ['echoChamber', 22, tile.id],
        ['termInsurance', 33, tile.id],
        ['typeFoundry', 44, tile.id],
      ]);
      const nextTileIndex = result.events.findIndex((event, index) =>
        index > destructionIndex && event.kind === 'tile' && event.tileId !== tile.id,
      );
      if (tileIndex < hand.length - 1) expect(nextTileIndex).toBeGreaterThan(destructionIndex + 4);
    }
    expect(result.jokers[0]!.state.factor).toBeCloseTo(1.6);
    expect(result.jokers[1]!.state['echo:uid:33:termInsurance:factor']).toBeCloseTo(1.6);
    expect(result.jokers[2]!.state.factor).toBeCloseTo(1.6);
    expect(result.jokers[3]!.state.factor).toBeCloseTo(3.375);
  });

  it('emits no destruction growth for survival, prevention, or debuff', () => {
    const survivalRun = newRun('conditional-growth-survival');
    survivalRun.jokers = [owned('termInsurance', 1, { factor: 1, revision20260826: 1 })];
    expect(play(survivalRun, tilesFor('CAT', 'first'), fixedRng(0.99)).events.filter(isGrowth))
      .toEqual([]);

    const preventedRun = newRun('conditional-growth-prevented');
    preventedRun.jokers = [
      owned('glassInsurance', 1),
      owned('termInsurance', 2, { factor: 1, revision20260826: 1 }),
    ];
    const prevented = play(preventedRun, tilesFor('CAT', 'first'), fixedRng(0));
    expect(prevented.destroyedTileIds).toEqual([]);
    expect(prevented.events.filter(isGrowth)).toEqual([]);

    const debuffedRun = newRun('conditional-growth-debuffed');
    debuffedRun.jokers = [owned('termInsurance', 1, { factor: 1, revision20260826: 1 })];
    const debuffed = play(debuffedRun, tilesFor('DAMN', 'all'), fixedRng(0), 'whitePaper');
    expect(debuffed.submission.debuffed).toBe(true);
    expect(debuffed.destroyedTileIds).toEqual([]);
    expect(debuffed.events.filter(isGrowth)).toEqual([]);
  });

  it('grows Type Foundry and Leak at the destruction beat without double-growing a retriggered tile', () => {
    const run = newRun('conditional-growth-other-destruction-scalers');
    const hand = tilesFor('CAT', 'first');
    hand[0]!.font = 'black';
    run.bag = [hand[0]!, ...run.bag.slice(1)];
    run.jokers = [
      owned('typeFoundry', 1, { factor: 1 }),
      owned('leak', 2, { minSize: run.bag.length, stacks: 0, mult: 0 }),
    ];
    const result = play(run, hand, fixedRng(0));
    const control = play(newRun('conditional-growth-other-scalers-control'),
      hand.map((tile) => ({ ...tile })), fixedRng(0));
    const destructionIndex = result.events.findIndex((event) =>
      event.kind === 'material' &&
      event.tileId === hand[0]!.id &&
      event.chanceResults?.some((chance) => chance.outcome === 'destroyed'),
    );
    expect(result.destroyedTileIds).toEqual([hand[0]!.id]);
    expect(result.events.filter((event) =>
      event.kind === 'material' &&
      event.tileId === hand[0]!.id &&
      event.chanceResults?.some((chance) => chance.outcome === 'destroyed'),
    )).toHaveLength(2);
    expect(result.events.slice(destructionIndex + 1, destructionIndex + 3)).toEqual([
      expect.objectContaining({
        kind: 'joker', jokerId: 'typeFoundry', jokerInstanceId: 1,
        tileId: hand[0]!.id, growthKind: 'mult', growthDelta: 0.5,
      }),
      expect.objectContaining({
        kind: 'joker', jokerId: 'leak', jokerInstanceId: 2,
        tileId: hand[0]!.id, growthKind: 'multAdd',
        growthDelta: BALANCE.jokers.leak.multPerMissingTile,
      }),
    ]);
    expect(result.events.filter((event) =>
      isGrowth(event) && event.tileId === hand[0]!.id,
    )).toHaveLength(2);
    expect(result.submission.settledScore).toBeCloseTo(control.submission.settledScore);
    expect(result.jokers[0]!.state.factor).toBeCloseTo(BALANCE.jokers.typeFoundry.factorPerTile);
    expect(result.jokers[1]!.state.mult).toBe(BALANCE.jokers.leak.multPerMissingTile);
  });

  it('presents Gold-font growth after its payout and applies Golden Type on later scores', () => {
    const run = newRun('conditional-growth-gold-font');
    run.jokers = [owned('goldenType', 1)];
    const hand = tilesFor('A');
    hand[0]!.font = 'lightItalic';
    const first = play(run, hand, fixedRng(0.99));

    const fontIndex = first.events.findIndex((event) =>
      event.kind === 'font' && event.effect === 'goldPlay' && event.tileId === hand[0]!.id,
    );
    expect(fontIndex).toBeGreaterThanOrEqual(0);
    expect(first.events[fontIndex + 1]).toMatchObject({
      kind: 'joker', jokerId: 'goldenType', jokerInstanceId: 1,
      tileId: hand[0]!.id, growthKind: 'chips',
      growthDelta: BALANCE.jokers.goldenType.chips,
    });
    expect(first.submission.settledScore).toBe(
      letterChips(hand) * (BALANCE.suitMult.standard + hand.length),
    );
    expect(first.updatedTiles[0]!.bonusChips).toBe(BALANCE.jokers.goldenType.chips);

    const nextRun = { ...run, jokers: first.jokers };
    const nextTile = { ...first.updatedTiles[0]!, id: `conditional-growth-${serial++}` };
    const next = play(nextRun, [nextTile], fixedRng(0.99));
    expect(next.submission.settledScore).toBe(
      letterChips([nextTile]) * (BALANCE.suitMult.standard + 1),
    );
  });

  it('places created-tile growth after its creator before intervening owned scorers', () => {
    const run = newRun('conditional-growth-created');
    run.jokers = [
      owned('counterfeit', 1),
      owned('redPencil', 2),
      owned('echoChamber', 3),
      owned('livingType', 4, { chips: 0 }),
    ];
    const hand = tilesFor('A');
    const first = play(run, hand, makeRng('conditional-growth-created-play'));
    const creatorIndex = first.events.findIndex((event) =>
      event.kind === 'joker' && event.jokerInstanceId === 1 &&
      (event.createdTileIds?.length ?? 0) > 0,
    );
    expect(creatorIndex).toBeGreaterThanOrEqual(0);
    const creator = first.events[creatorIndex];
    if (creator?.kind !== 'joker' || !creator.createdTileIds) {
      throw new Error('missing Counterfeit creation event');
    }
    const expectedGrowth = creator.createdTileIds.flatMap((tileId) => [
      ['echoChamber', 3, tileId],
      ['livingType', 4, tileId],
    ]);
    const growth = first.events.slice(creatorIndex + 1, creatorIndex + 1 + expectedGrowth.length);
    expect(growth.map((event) => event.kind === 'joker'
      ? [event.jokerId, event.jokerInstanceId, event.tileId]
      : null)).toEqual(expectedGrowth);
    expect(first.events.findIndex((event) =>
      event.kind === 'joker' && event.jokerInstanceId === 2 && event.tileId === undefined,
    )).toBeGreaterThan(creatorIndex + expectedGrowth.length);

    const plainRun = newRun('conditional-growth-created-plain');
    plainRun.jokers = [owned('counterfeit', 1), owned('redPencil', 2)];
    const plain = play(plainRun, hand, makeRng('conditional-growth-created-play'));
    expect(first.submission.settledScore).toBe(plain.submission.settledScore);
    expect(first.events).toHaveLength(plain.events.length + expectedGrowth.length);

    const chipsPerOwner = creator.createdTileIds.length * BALANCE.jokers.livingType.chipsPerTile;
    expect(first.jokers.find((joker) => joker.instanceId === 4)?.state.chips).toBe(chipsPerOwner);
    const nextRun = { ...run, jokers: first.jokers };
    const nextHand = tilesFor('A');
    const next = submitWord(
      { ...first.blind, hand: nextHand, bag: [] },
      nextRun,
      lexicon,
      nextHand.map((tile) => tile.id),
      makeRng('conditional-growth-created-next'),
    );
    expect(next.submission.settledScore).toBe(
      (letterChips(nextHand) + BALANCE.jokers.redPencil.chips + chipsPerOwner * 2) *
      (BALANCE.suitMult.standard + 1),
    );

    const oldOrder: ScoreEvent[] = first.events.filter((event) => !growth.includes(event));
    oldOrder.splice(oldOrder.length - 1, 0, ...growth);
    expect(oldOrder).toHaveLength(first.events.length);
    for (const speed of [1, 2]) {
      expect(settleDurationMs(first.events, speed, false))
        .toBe(settleDurationMs(oldOrder, speed, false));
    }
  });

  it('keeps seeded destruction output and event order reproducible', () => {
    const run = newRun('conditional-growth-seeded');
    run.jokers = [owned('termInsurance', 1, { factor: 1, revision20260826: 1 })];
    const hand = tilesFor('CAT', 'all');
    const replay = () => play(run, hand.map((tile) => ({ ...tile })), makeRng('conditional-growth-action'));
    const first = replay();
    const second = replay();
    expect(second.destroyedTileIds).toEqual(first.destroyedTileIds);
    expect(second.events).toEqual(first.events);
    expect(second.jokers).toEqual(first.jokers);
  });

  it('reorders the same event budget without changing RNG use or settle duration', () => {
    const countingRng = () => {
      let calls = 0;
      const rng: Rng = {
        next: () => { calls += 1; return 0; },
        int: (max) => Math.min(max - 1, 0),
        shuffle: <T>(items: readonly T[]) => [...items],
      };
      return { rng, calls: () => calls };
    };
    const plainRun = newRun('conditional-growth-event-budget-plain');
    const termRun = newRun('conditional-growth-event-budget-term');
    termRun.jokers = [owned('termInsurance', 1, { factor: 1.4, revision20260826: 1 })];
    const plainRoll = countingRng();
    const termRoll = countingRng();
    const plain = play(plainRun, tilesFor('CAT', 'first'), plainRoll.rng);
    const result = play(termRun, tilesFor('CAT', 'first'), termRoll.rng);

    expect(termRoll.calls()).toBe(plainRoll.calls());
    expect(result.events).toHaveLength(plain.events.length + 2);
    expect(result.events.filter(isGrowth)).toHaveLength(1);

    const growth = result.events.filter(isGrowth);
    const oldOrder: ScoreEvent[] = result.events.filter((event) => !isGrowth(event));
    oldOrder.splice(oldOrder.length - 1, 0, ...growth);
    expect(oldOrder).toHaveLength(result.events.length);
    for (const speed of [1, 2]) {
      expect(settleDurationMs(result.events, speed, false))
        .toBe(settleDurationMs(oldOrder, speed, false));
    }
    expect(settleDurationMs(result.events, 1, true)).toBe(700);
  });
});
