import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { JokerEdition, Letter, OwnedJoker, ScoreEvent, Tile } from '../src/engine/types';
import { foldScoreTypewriterEvents, settleDurationMs } from '../src/ui/settle';

const lexicon = makeLexicon([], {
  cat: { suit: 'standard', pos: ['noun'] },
  damn: { suit: 'vulgar', pos: ['noun'] },
  q: { suit: 'standard', pos: ['noun'] },
});

let serial = 0;
const tilesFor = (word: string): Tile[] => [...word.toUpperCase()].map((letter) => ({
  id: `joker-edition-order-${serial++}`,
  letter: letter as Letter,
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
}));

const owned = (
  defId: string,
  edition: JokerEdition,
  instanceId: number,
  state: OwnedJoker['state'] = {},
): OwnedJoker => ({ defId, edition, instanceId, state });

const play = (jokers: OwnedJoker[], word = 'CAT') => {
  const run = newRun(`joker-edition-order-${serial++}`);
  run.jokers = jokers;
  const hand = tilesFor(word);
  return submitWord(
    { ...startBlind(run, makeRng(`${run.seed}-blind`)), hand },
    run,
    lexicon,
    hand.map((tile) => tile.id),
    makeRng(`${run.seed}-play`),
  );
};

type OwnedScoreEvent = Extract<ScoreEvent, { kind: 'edition' | 'joker' }>;
const ownedEvents = (events: ScoreEvent[]): OwnedScoreEvent[] => events.filter(
  (event): event is OwnedScoreEvent =>
    (event.kind === 'edition' || event.kind === 'joker') && event.tileId === undefined,
);

describe('owned Emoji Tile edition scoring order', () => {
  it('groups each physical owner as edition then intrinsic effect, left to right', () => {
    const stargazerFactor = 1 + BALANCE.jokers.stargazer.factorPerCard;
    const dogFoodMult = BALANCE.jokers.dogFood.multPerReroll;
    const result = play([
      owned('stargazer', 'violet', 11, { factor: stargazerFactor }),
      owned('dogFood', 'rainbow', 22, { mult: dogFoodMult }),
    ]);

    expect(ownedEvents(result.events).map((event) => [
      event.kind,
      event.kind === 'edition' ? event.edition : event.jokerId,
      event.jokerInstanceId,
    ])).toEqual([
      ['edition', 'violet', 11],
      ['joker', 'stargazer', 11],
      ['edition', 'rainbow', 22],
      ['joker', 'dogFood', 22],
    ]);

    const baseMult = 1 + 'CAT'.length;
    const stargazerEvent = result.events.find((event) =>
      event.kind === 'joker' && event.jokerInstanceId === 11,
    );
    expect(stargazerEvent).toMatchObject({
      kind: 'joker',
      multFactor: stargazerFactor,
    });
    expect(stargazerEvent?.kind === 'joker' ? stargazerEvent.multDelta : Number.NaN)
      .toBeCloseTo((baseMult + BALANCE.edition.violetMult) * (stargazerFactor - 1));
    const expectedMult = (
      (baseMult + BALANCE.edition.violetMult) * stargazerFactor
    ) * BALANCE.edition.rainbowFactor + dogFoodMult;
    expect(result.events.at(-1)).toMatchObject({ kind: 'settle', mult: expectedMult });
    expect(result.submission.settledScore).toBeCloseTo(15 * expectedMult);
  });

  it('uses edition-first arithmetic for isolated additive and multiplicative owners', () => {
    const additive = play([
      owned('dogFood', 'rainbow', 23, { mult: BALANCE.jokers.dogFood.multPerReroll }),
    ]);
    expect(additive.submission.settledScore).toBe(120);

    const factor = 1 + BALANCE.jokers.stargazer.factorPerCard;
    const multiplicative = play([owned('stargazer', 'violet', 24, { factor })]);
    expect(multiplicative.submission.settledScore)
      .toBeCloseTo(15 * (4 + BALANCE.edition.violetMult) * factor);

    const gray = play([owned('redPencil', 'gray', 25)]);
    expect(gray.submission.settledScore).toBe(
      (15 + BALANCE.edition.grayChips + BALANCE.jokers.redPencil.chips) * 4,
    );
  });

  it('keeps tile-bound Emoji effects in the played-tile phase before owner edition scoring', () => {
    const result = play([owned('rareEarth', 'gray', 33)], 'Q');
    const rareEarthIndex = result.events.findIndex((event) =>
      event.kind === 'joker' && event.jokerId === 'rareEarth' && event.tileId !== undefined,
    );
    const editionIndex = result.events.findIndex((event) =>
      event.kind === 'edition' && event.jokerId === 'rareEarth',
    );

    expect(rareEarthIndex).toBeGreaterThanOrEqual(0);
    expect(editionIndex).toBeGreaterThan(rareEarthIndex);
    expect(result.events[editionIndex]).toMatchObject({
      kind: 'edition', edition: 'gray', jokerInstanceId: 33,
      chipsDelta: BALANCE.edition.grayChips,
    });
    expect(ownedEvents(result.events)).toHaveLength(1);
  });

  it('keeps an owner decay beat after its edition and intrinsic score', () => {
    const result = play([
      owned('dullingPencil', 'gray', 34, { chips: BALANCE.jokers.dullingPencil.chips }),
    ]);

    expect(ownedEvents(result.events).map((event) => [
      event.kind,
      event.kind === 'edition' ? event.edition : event.growthKind ?? event.jokerId,
      event.jokerInstanceId,
    ])).toEqual([
      ['edition', 'gray', 34],
      ['joker', 'dullingPencil', 34],
      ['joker', 'chips', 34],
    ]);
  });

  it('places one edition beat before every intrinsic multi-beat', () => {
    const run = newRun('joker-edition-order-multi');
    run.jokers = [owned('rotaryPress', 'gray', 35)];
    const hand = tilesFor('CAT');
    const blind = {
      ...startBlind(run, makeRng('joker-edition-order-multi-blind')),
      hand,
      phasesUsed: 4,
      phasesTotal: 5,
      sequence: [111, 222].map((settledScore, index) => ({
        tiles: [], text: `WORD${index}`, isGibberish: false,
        suit: 'standard' as const, posUsed: 'noun' as const, settledScore,
      })),
    };
    const result = submitWord(
      blind, run, lexicon, hand.map((tile) => tile.id), makeRng('joker-edition-order-multi-play'),
    );

    expect(ownedEvents(result.events).map((event) => [
      event.kind,
      event.kind === 'edition' ? event.chipsDelta : event.scoreDelta,
      event.jokerInstanceId,
    ])).toEqual([
      ['edition', BALANCE.edition.grayChips, 35],
      ['joker', 111, 35],
      ['joker', 222, 35],
    ]);
    expect(result.submission.settledScore).toBe((15 + BALANCE.edition.grayChips) * 4 + 333);
  });

  it('applies an edition alone when the intrinsic effect is ineligible on Gibberish', () => {
    const plain = play([], 'ZZZ');
    const result = play([owned('redPencil', 'rainbow', 36)], 'ZZZ');

    expect(result.submission.isGibberish).toBe(true);
    expect(ownedEvents(result.events)).toEqual([
      expect.objectContaining({
        kind: 'edition', edition: 'rainbow', jokerInstanceId: 36,
        multFactor: BALANCE.edition.rainbowFactor,
      }),
    ]);
    expect(result.submission.settledScore)
      .toBe(plain.submission.settledScore * BALANCE.edition.rainbowFactor);
  });

  it('keeps duplicate ids paired by physical instance and does not copy target editions through Echo', () => {
    const duplicates = play([
      owned('dogFood', 'gray', 41, { mult: 2 }),
      owned('dogFood', 'violet', 42, { mult: 4 }),
    ]);
    expect(ownedEvents(duplicates.events).map((event) => [event.kind, event.jokerInstanceId]))
      .toEqual([
        ['edition', 41], ['joker', 41],
        ['edition', 42], ['joker', 42],
      ]);

    const echoed = play([
      owned('echoChamber', 'base', 51),
      owned('redPencil', 'violet', 52),
    ]);
    expect(ownedEvents(echoed.events).map((event) => [
      event.kind,
      event.kind === 'edition' ? event.edition : event.jokerId,
      event.jokerInstanceId,
    ])).toEqual([
      ['joker', 'echoChamber', 51],
      ['edition', 'violet', 52],
      ['joker', 'redPencil', 52],
    ]);
  });

  it.each(['base', 'white'] as const)('%s has no scoring-edition event', (edition) => {
    const result = play([
      owned('dogFood', edition, 44, { mult: BALANCE.jokers.dogFood.multPerReroll }),
    ]);
    expect(result.events.some((event) => event.kind === 'edition' && event.jokerId === 'dogFood'))
      .toBe(false);
    expect(ownedEvents(result.events)).toEqual([
      expect.objectContaining({ kind: 'joker', jokerId: 'dogFood', jokerInstanceId: 44 }),
    ]);
  });

  it('suppresses both edition and intrinsic scoring when the owner is boss-disabled', () => {
    const plain = play([]);
    const disabled = play([
      owned('dogFood', 'violet', 55, {
        mult: BALANCE.jokers.dogFood.multPerReroll,
        bossDisabled: 1,
      }),
    ]);

    expect(ownedEvents(disabled.events)).toEqual([]);
    expect(disabled.submission.settledScore).toBe(plain.submission.settledScore);
  });

  it('suppresses normal edition and intrinsic scoring on a debuffed submission', () => {
    const run = newRun('joker-edition-order-debuff');
    run.jokers = [owned('dogFood', 'violet', 56, { mult: 2 })];
    const hand = tilesFor('DAMN');
    const blind = {
      ...startBlind(run, makeRng('joker-edition-order-debuff-blind'), {
        kind: 'boss', bossId: 'whitePaper', target: 1_000,
      }),
      hand,
    };
    const result = submitWord(
      blind, run, lexicon, hand.map((tile) => tile.id), makeRng('joker-edition-order-debuff-play'),
    );

    expect(result.submission.debuffed).toBe(true);
    expect(result.submission.settledScore).toBe(0);
    expect(ownedEvents(result.events)).toEqual([]);
  });

  it('keeps held scoring after the complete edition-first owned list', () => {
    const run = newRun('joker-edition-order-held');
    run.jokers = [owned('dogFood', 'rainbow', 57, { mult: 2 })];
    const staged = tilesFor('CAT');
    const held: Tile = {
      id: 'joker-edition-order-held-brass', letter: 'H',
      material: 'brass', font: 'medium', edition: 'base',
    };
    const blind = {
      ...startBlind(run, makeRng('joker-edition-order-held-blind')),
      hand: [...staged, held],
    };
    const result = submitWord(
      blind, run, lexicon, staged.map((tile) => tile.id), makeRng('joker-edition-order-held-play'),
    );
    const editionIndex = result.events.findIndex((event) => event.kind === 'edition');
    const ownerIndex = result.events.findIndex((event) =>
      event.kind === 'joker' && event.jokerInstanceId === 57 && event.tileId === undefined,
    );
    const heldIndex = result.events.findIndex((event) =>
      event.kind === 'material' && event.tileId === held.id,
    );
    expect(editionIndex).toBeGreaterThanOrEqual(0);
    expect(ownerIndex).toBeGreaterThan(editionIndex);
    expect(heldIndex).toBeGreaterThan(ownerIndex);
  });

  it('does not change seeded Joker RNG consumption or output', () => {
    const seeded = () => {
      const run = newRun('joker-edition-order-rng');
      run.jokers = [owned('counterfeit', 'rainbow', 58)];
      const hand: Tile[] = [{
        id: 'joker-edition-order-rng-q', letter: 'Q',
        material: 'ceramic', font: 'medium', edition: 'base',
      }];
      return submitWord(
        { ...startBlind(run, makeRng('joker-edition-order-rng-blind')), hand },
        run,
        lexicon,
        [hand[0]!.id],
        makeRng('joker-edition-order-rng-play'),
      );
    };
    const first = seeded();
    const second = seeded();
    expect(first.createdTiles).toEqual(second.createdTiles);
    expect(first.events).toEqual(second.events);
    expect(ownedEvents(first.events).map((event) => event.kind)).toEqual(['edition', 'joker']);
  });

  it('keeps UI folding authoritative and only reorders the existing enhanced slot', () => {
    const result = play([
      owned('dogFood', 'rainbow', 59, { mult: BALANCE.jokers.dogFood.multPerReroll }),
    ]);
    const settle = result.events.at(-1);
    expect(settle?.kind).toBe('settle');
    if (settle?.kind !== 'settle') throw new Error('missing settle event');

    const folded = foldScoreTypewriterEvents(result.events, 1_000);
    expect(folded.chips).toBe(settle.chips);
    expect(folded.mult).toBe(settle.mult);
    expect(folded.flatScore).toBe(0);
    expect(folded.primaryKeyId).toMatch(/^F(?:[1-9]|1[0-2])$/);

    const withoutEdition = result.events.filter((event) => event.kind !== 'edition');
    expect(settleDurationMs(result.events, 1, false) - settleDurationMs(withoutEdition, 1, false))
      .toBe(1_000);
    expect(settleDurationMs(result.events, 1, true)).toBe(700);
  });
});
