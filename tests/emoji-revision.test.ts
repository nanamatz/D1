import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { BALANCE } from '../src/engine/balance';
import {
  ALL_JOKERS, addOwnedJoker, createOwnedJoker, normalizeOwnedJokerInstanceIds,
  onBlindEndedWithDestroyedJokers, onTilesDestroyed,
} from '../src/engine/jokers';
import { findSpellableWords } from '../src/engine/hint';
import { discardTiles, enterJokerBlind, prepareWordSubmission, startBlind, submitWord } from '../src/engine/loop';
import { makeLexicon } from '../src/engine/lexicon';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { buyItem, repriceShop, sellJoker } from '../src/engine/shop';
import type { Letter, ShopState, Tile } from '../src/engine/types';
import { allowsDuplicateOffers, emojiTileShopPrice, jokerSlotLimit } from '../src/engine/vouchers';

let serial = 0;
const tiles = (word: string): Tile[] => [...word].map((letter) => ({
  id: `revision-${serial++}`, letter: letter as Letter,
  material: 'ceramic', font: 'medium', edition: 'base',
}));
const lex = makeLexicon([], { cat: { suit: 'standard', pos: ['noun'] } });
const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: (max) => Math.min(max - 1, Math.floor(value * max)),
  shuffle: <T,>(items: readonly T[]) => [...items],
});

describe('2026-08-26 Emoji Tile revision', () => {
  it('pairs all 150 descriptions and removes retired effect wording', () => {
    for (const def of ALL_JOKERS) {
      const key = `jokerdesc.${def.id}`;
      expect((ko as Record<string, string>)[key], key).toBeTypeOf('string');
      expect((en as Record<string, string>)[key], key).toBeTypeOf('string');
    }
    const effectKey = /^(jokerdesc|jokerunlock|letterhand\..*\.desc|bossdesc|skipReward\..*[Dd]esc|materialdesc|consumabledesc|patterndesc)/;
    for (const locale of [ko, en] as Array<Record<string, string>>) {
      for (const [key, value] of Object.entries(locale)) {
        if (effectKey.test(key)) expect(value, key).not.toMatch(
          /영구적으로|정확히|유효 단어|동일한|permanently|exactly|valid word|identical/i,
        );
      }
    }
  });

  it('Uncensored is the sole event on a debuffed word and settles at 100', () => {
    const run = newRun('revision-uncensored');
    run.jokers = [createOwnedJoker(run, 'uncensored'), { ...createOwnedJoker(run, 'redPencil'), instanceId: 2 }];
    const hand = tiles('CAT');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand, lipogramLetters: ['A'] }, run, lex,
      hand.map((tile) => tile.id), makeRng('revision-uncensored-play'),
    );
    const events = result.events.filter((event) => event.kind === 'joker');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ jokerId: 'uncensored', chipsDelta: 100 });
    expect(result.submission.settledScore).toBe(100);
  });

  it('Term Insurance grows once per destroyed tile without prevention', () => {
    const run = newRun('revision-term');
    run.jokers = [createOwnedJoker(run, 'termInsurance')];
    expect(onTilesDestroyed(run, 2).jokers[0]!.state.factor).toBeCloseTo(1.4);
  });

  it('Blackletter returns enhanced tiles after score without mutating input', () => {
    const run = newRun('revision-blackletter');
    run.jokers = [createOwnedJoker(run, 'blackletterEngine')];
    const hand = tiles('CAT');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand }, run, lex,
      hand.map((tile) => tile.id), makeRng('revision-blackletter-play'),
    );
    expect(hand.map((tile) => tile.font)).toEqual(['medium', 'medium', 'medium']);
    expect(result.events.some((event) => event.kind === 'font')).toBe(false);
    expect(result.updatedTiles.map((tile) => tile.font)).toEqual(['black', 'black', 'black']);
    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'blackletterEngine',
    )).toHaveLength(3);
  });

  it('Blackletter ignores destroyed Glass and attributes copied enhancements to Echo', () => {
    let shattered = newRun('revision-blackletter-glass');
    shattered = addOwnedJoker(addOwnedJoker(shattered, 'blackletterEngine'), 'blacksmith');
    const glass = tiles('CAT').map((tile) => ({ ...tile, material: 'glass' as const }));
    const shatteredResult = submitWord(
      { ...startBlind(shattered, makeRng(shattered.seed)), hand: glass }, shattered, lex,
      glass.map((tile) => tile.id), fixedRng(0),
    );
    expect(shatteredResult.destroyedTileIds).toHaveLength(3);
    expect(shatteredResult.events.some(
      (event) => event.kind === 'joker' && event.jokerId === 'blackletterEngine',
    )).toBe(false);
    expect(shatteredResult.jokers.find((joker) => joker.defId === 'blacksmith')?.state.chips ?? 0)
      .toBe(0);

    let copied = newRun('revision-blackletter-echo');
    copied = addOwnedJoker(addOwnedJoker(copied, 'echoChamber'), 'blackletterEngine');
    const hand = tiles('CAT');
    const copiedResult = submitWord(
      { ...startBlind(copied, makeRng(copied.seed)), hand }, copied, lex,
      hand.map((tile) => tile.id), makeRng('revision-blackletter-echo-play'),
    );
    expect(copiedResult.events.filter(
      (event) => event.kind === 'joker' && event.tileId && event.jokerId === 'echoChamber',
    ).map((event) => event.kind === 'joker' ? event.jokerInstanceId : undefined))
      .toEqual([1, 1, 1]);
  });

  it('Alphabet Poet projects Z as A while preserving the physical tile', () => {
    const run = newRun('revision-poet');
    run.jokers = [createOwnedJoker(run, 'alphabetPoet')];
    const hand = tiles('CZT');
    const prepared = prepareWordSubmission(hand, makeLexicon([], {
      cat: { suit: 'standard', pos: ['noun'] },
    }), run, startBlind(run, makeRng(run.seed)));
    expect(prepared.submission.text).toBe('CAT');
    expect(hand[1]!.letter).toBe('Z');
    expect(findSpellableWords(hand, makeLexicon([], {
      cat: { suit: 'standard', pos: ['noun'] },
    }), 1, { run, blind: startBlind(run, makeRng('revision-poet-hint')) })[0])
      .toMatchObject({ word: 'cat', tileIds: hand.map((tile) => tile.id) });
  });

  it.each(['AZ', 'ZA'])('Alphabet Poet hint ranks physical Z Chips for %s order', (order) => {
    const run = newRun(`revision-poet-hint-${order}`);
    run.jokers = [createOwnedJoker(run, 'alphabetPoet')];
    const hand = tiles(order);
    const oneLetterLexicon = makeLexicon([], {
      a: { suit: 'standard', pos: ['noun'] },
    });
    const blind = { ...startBlind(run, makeRng(`${run.seed}-blind`)), hand };
    const [hint] = findSpellableWords(hand, oneLetterLexicon, 1, { run, blind });
    const physicalZ = hand.find((tile) => tile.letter === 'Z')!;
    expect(hint).toMatchObject({ word: 'a', tileIds: [physicalZ.id], score: 60 });
    const submitted = submitWord(
      blind, run, oneLetterLexicon, [physicalZ.id], makeRng(`${run.seed}-submit`),
    );
    expect(submitted.submission.text).toBe('A');
    expect(submitted.submission.settledScore).toBe(hint!.score);
  });

  it('records discard and blind-entry growth as ordered per-unit triggers', () => {
    let run = newRun('revision-discard-events');
    run = addOwnedJoker(addOwnedJoker(addOwnedJoker(
      run, 'discardedDraft'), 'recycling'), 'hollowPromise');
    run.jokers[1]!.state.letterCode = 'A'.charCodeAt(0);
    const hand = tiles('AA').map((tile) => ({ ...tile, font: 'inline' as const }));
    const discarded = discardTiles(
      { ...startBlind(run, makeRng(run.seed)), hand }, run,
      hand.map((tile) => tile.id), makeRng('revision-discard-events-action'),
    );
    expect(discarded.run.lifecycleGrowthEvents?.slice(-6).map((event) => [
      event.jokerInstanceId, event.kind, event.delta,
    ])).toEqual([
      [1, 'chips', BALANCE.jokers.discardedDraft.chipsPerTile],
      [2, 'gold', BALANCE.jokers.recycling.goldPerTile],
      [3, 'gold', BALANCE.jokers.hollowPromise.goldPerTile],
      [1, 'chips', BALANCE.jokers.discardedDraft.chipsPerTile],
      [2, 'gold', BALANCE.jokers.recycling.goldPerTile],
      [3, 'gold', BALANCE.jokers.hollowPromise.goldPerTile],
    ]);

    const blindRun = newRun('revision-blind-entry-events');
    blindRun.jokers = [
      { ...createOwnedJoker(blindRun, 'megalith'), instanceId: 1 },
      { ...createOwnedJoker(blindRun, 'megalith'), instanceId: 2 },
      { ...createOwnedJoker(blindRun, 'livingType'), instanceId: 3 },
    ];
    const entered = enterJokerBlind(
      blindRun, startBlind(blindRun, makeRng(blindRun.seed)),
      makeRng('revision-blind-entry-events-action'),
    );
    expect(entered.createdTiles).toHaveLength(2);
    expect(entered.run.lifecycleGrowthEvents?.filter(
      (event) => event.jokerInstanceId === 3 && event.kind === 'chips',
    )).toHaveLength(2);
  });

  it('recomputes dynamic $0 shop prices while explicit free Tags stay free', () => {
    let run = newRun('revision-carte-live');
    run = addOwnedJoker(addOwnedJoker(run, 'echoChamber'), 'carteBlanche');
    const shop: ShopState = {
      items: [{ kind: 'joker', id: 'redPencil', edition: 'base', price: 0 }],
      voucher: null, bonusVoucher: null, packs: [], rerolls: 0,
    };
    expect(repriceShop(run, shop).items[0]?.price).toBe(0);
    const reordered = { ...run, jokers: [run.jokers[1]!, run.jokers[0]!] };
    expect(repriceShop(reordered, shop).items[0]?.price).toBe(
      BALANCE.jokerPrice.common - BALANCE.jokers.carteBlanche.shopDiscount,
    );
    const plain = newRun('revision-carte-stale-checkout');
    plain.gold = 0;
    expect(buyItem(plain, shop, 0).ok).toBe(false);
    expect(repriceShop(plain, {
      ...shop,
      items: [{ ...shop.items[0]!, free: true }],
    }).items[0]).toMatchObject({ price: 0, free: true });

    run.jokers[0]!.state['echo:uid:2:wordHunter:factor'] = 2;
    const sold = sellJoker(run, 1, makeRng('revision-carte-sell'));
    expect(sold.run.jokers[0]!.state['echo:uid:2:wordHunter:factor']).toBeUndefined();
  });

  it('copied self-destruction removes the physical Echo without ghost state', () => {
    let run = newRun('revision-echo-self-destroy');
    run = addOwnedJoker(addOwnedJoker(run, 'echoChamber'), 'dullingPencil');
    run.jokers[0]!.state['echo:uid:2:dullingPencil:chips'] =
      BALANCE.jokers.dullingPencil.chipsLostPerHand;
    const hand = tiles('CAT');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand }, run, lex,
      hand.map((tile) => tile.id), makeRng('revision-echo-self-destroy-play'),
    );
    expect(result.destroyedJokers.map(({ joker }) => joker.instanceId)).toContain(1);
    expect(result.jokers.map((joker) => joker.defId)).toEqual(['dullingPencil']);
    const destroyedEcho = result.destroyedJokers.find(({ joker }) => joker.instanceId === 1)!.joker;
    expect(Object.keys(destroyedEcho.state).filter((key) => key.startsWith('echo:'))).toEqual([]);

    let misbound = newRun('revision-echo-misbound-destroy');
    misbound = addOwnedJoker(addOwnedJoker(misbound, 'echoChamber'), 'misbound');
    const ended = onBlindEndedWithDestroyedJokers(
      misbound, startBlind(misbound, makeRng(misbound.seed)), fixedRng(0),
    );
    expect(ended.destroyedJokers.map(({ joker }) => joker.instanceId)).toEqual([1, 2]);
    expect(ended.run.jokers).toEqual([]);
  });

  it('Echo copies the right scoring hook and three passive capabilities', () => {
    let scoring = newRun('revision-echo-score');
    scoring = addOwnedJoker(addOwnedJoker(scoring, 'echoChamber'), 'redPencil');
    const hand = tiles('CAT');
    const result = submitWord(
      { ...startBlind(scoring, makeRng(scoring.seed)), hand }, scoring, lex,
      hand.map((tile) => tile.id), makeRng('revision-echo-play'),
    );
    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'echoChamber',
    )).toHaveLength(1);
    let slots = newRun('revision-echo-slots');
    slots = addOwnedJoker(addOwnedJoker(slots, 'echoChamber'), 'bookOfMargins');
    expect(jokerSlotLimit(slots)).toBe(slots.jokerSlots + 6);
    let prices = newRun('revision-echo-prices');
    prices = addOwnedJoker(addOwnedJoker(prices, 'echoChamber'), 'carteBlanche');
    expect(emojiTileShopPrice(prices, 10)).toBe(6);
    let copies = newRun('revision-echo-copies');
    copies = addOwnedJoker(addOwnedJoker(copies, 'echoChamber'), 'copyEditor');
    expect(allowsDuplicateOffers(copies)).toBe(true);
    copies.jokers[1]!.state.bossDisabled = 1;
    expect(allowsDuplicateOffers(copies)).toBe(false);
  });

  it('attributes duplicate definitions and Echo chains to physical owner UIDs', () => {
    let duplicates = newRun('revision-duplicate-attribution');
    duplicates = addOwnedJoker(addOwnedJoker(duplicates, 'redPencil'), 'redPencil');
    let hand = tiles('CAT');
    let result = submitWord(
      { ...startBlind(duplicates, makeRng(duplicates.seed)), hand }, duplicates, lex,
      hand.map((tile) => tile.id), makeRng('revision-duplicate-attribution-play'),
    );
    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'redPencil',
    ).map((event) => event.kind === 'joker' ? event.jokerInstanceId : undefined)).toEqual([1, 2]);

    let chain = newRun('revision-echo-chain-attribution');
    chain = addOwnedJoker(addOwnedJoker(addOwnedJoker(
      chain, 'echoChamber'), 'echoChamber'), 'redPencil');
    hand = tiles('CAT');
    result = submitWord(
      { ...startBlind(chain, makeRng(chain.seed)), hand }, chain, lex,
      hand.map((tile) => tile.id), makeRng('revision-echo-chain-attribution-play'),
    );
    expect(result.events.filter(
      (event) => event.kind === 'joker' &&
        (event.jokerId === 'echoChamber' || event.jokerId === 'redPencil'),
    ).map((event) => event.kind === 'joker' ? event.jokerInstanceId : undefined)).toEqual([1, 2, 3]);
  });

  it('keeps inventory layer-1 effects active on Gibberish', () => {
    const run = newRun('revision-gibberish-layer1');
    run.jokers = [createOwnedJoker(run, 'scrapDealer')];
    run.bag = run.bag.slice(0, 2).map((tile) => ({ ...tile, material: 'brass' }));
    const hand = tiles('ZZZ');
    const result = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand }, run, lex,
      hand.map((tile) => tile.id), makeRng('revision-gibberish-layer1-play'),
    );
    expect(result.submission.isGibberish).toBe(true);
    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'scrapDealer',
    )).toEqual([
      expect.objectContaining({ multDelta: BALANCE.jokers.scrapDealer.factorPerBrass }),
      expect.objectContaining({ multDelta: BALANCE.jokers.scrapDealer.factorPerBrass }),
    ]);
  });

  it('migrates legacy scaler proc counts once, including Echo state', () => {
    const run = newRun('revision-legacy');
    run.jokers = [
      { defId: 'misbound', edition: 'base', state: { factor: 2.6 } },
      { defId: 'biochemistry', edition: 'base', state: { factor: 1.9, lastHand: 1 } },
      { defId: 'serial', edition: 'base', state: { chips: 39 } },
      { defId: 'echoChamber', edition: 'base', state: {
        'echo:uid:9:misbound:factor': 1.8,
        'echo:uid:10:misbound:factor': 2.6,
      } },
    ];
    const migrated = normalizeOwnedJokerInstanceIds(run);
    expect(migrated.jokers[0]!.state.factor).toBe(2);
    expect(migrated.jokers[1]!.state.factor).toBe(2);
    expect(migrated.jokers[1]!.state.lastHand).toBeUndefined();
    expect(migrated.jokers[2]!.state.chips).toBe(60);
    expect(migrated.jokers[3]!.state['echo:uid:9:misbound:factor']).toBe(1.5);
    expect(migrated.jokers[3]!.state['echo:uid:10:misbound:factor']).toBe(2);
    expect(normalizeOwnedJokerInstanceIds(migrated)).toEqual(migrated);
  });

  it('marks newly acquired revised scalers so save normalization is lossless', () => {
    for (const id of ['misbound', 'biochemistry', 'serial', 'termInsurance']) {
      const run = newRun(`revision-new-${id}`);
      run.jokers = [createOwnedJoker(run, id)];
      const normalized = normalizeOwnedJokerInstanceIds(run);
      expect(normalized.jokers[0]!.state).toEqual(run.jokers[0]!.state);
      expect(normalized.jokers[0]!.state.revision20260826).toBe(1);
    }
  });
});
