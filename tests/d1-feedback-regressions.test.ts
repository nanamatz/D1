import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { createOwnedJoker } from '../src/engine/jokers';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Letter, Tile } from '../src/engine/types';
import { mergeSubmitResult } from '../src/sim/full-run-balance';
import { bossDescription } from '../src/ui/descriptions';
import { resolve } from '../src/ui/i18n';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const lexicon = makeLexicon([], {
  cat: { suit: 'standard', pos: ['noun'] },
});

const wordTiles = (word: string, material: Tile['material'] = 'ceramic'): Tile[] =>
  [...word.toUpperCase()].map((letter, index) => ({
    id: `d1-${word}-${index}`,
    letter: letter as Letter,
    material,
    font: 'medium',
    edition: 'base',
  }));

describe('D1 gameplay feedback regressions', () => {
  it('grows each played Wood tile exactly once and returns one authoritative snapshot', () => {
    const run = newRun('d1-wood-growth');
    const hand = wordTiles('cat', 'wood');
    run.bag = hand;
    const started = startBlind(run, makeRng('d1-wood-blind'));
    const result = submitWord(
      { ...started, hand, bag: [] },
      run,
      lexicon,
      hand.map(({ id }) => id),
      makeRng('d1-wood-submit'),
    );
    const expected = BALANCE.materials.wood.baseChips + BALANCE.materials.wood.chipsPerPlay;

    expect(result.grownWoodTileIds).toEqual(hand.map(({ id }) => id));
    for (const snapshot of [
      result.submission.tiles,
      result.updatedTiles,
      result.blind.sequence[0]!.tiles,
      result.blind.discardedThisBlind,
    ]) {
      expect(snapshot.map(({ woodBonusChips }) => woodBonusChips)).toEqual([
        expected, expected, expected,
      ]);
    }
    expect(mergeSubmitResult(run, result).bag.map(({ woodBonusChips }) => woodBonusChips))
      .toEqual([expected, expected, expected]);
  });

  it('does not emit a neutral Scarlet Letter beat and synchronizes stale state to its ledger', () => {
    const run = newRun('d1-scarlet-neutral');
    run.jokers = [
      { ...createOwnedJoker(run, 'scarletLetter'), state: { factor: 1.3 } },
    ];
    const hand = wordTiles('cat');
    const result = submitWord(
      { ...startBlind(run, makeRng('d1-scarlet-blind')), hand },
      run,
      lexicon,
      hand.map(({ id }) => id),
      makeRng('d1-scarlet-submit'),
    );

    expect(result.jokers[0]!.state.factor).toBe(1);
    expect(result.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'scarletLetter',
    )).toEqual([]);
  });
});

describe('D1 UI contract wiring', () => {
  const source = (path: string) => readFileSync(path, 'utf8');
  const translate = (lang: 'en' | 'ko') => (
    key: string | string[],
    params?: Record<string, string | number>,
  ) => resolve({ en, ko }, lang, key, params);

  it('uses the revised static copy and discloses the live Stereotype Plate floor', () => {
    expect(en['jokerdesc.termInsurance']).not.toContain('×1 Mult');
    expect(ko['jokerdesc.termInsurance']).not.toContain('×1 배수');
    expect(JSON.stringify(ko)).not.toContain('원고료');

    const run = newRun('stereotype-description');
    expect(bossDescription('stereotypePlate', translate('en'), run))
      .toBe(en['bossdesc.stereotypePlate.none']);
    run.wordsThisAnte = ['cat', 'bright'];
    expect(bossDescription('stereotypePlate', translate('en'), run)).toContain('6');
    expect(bossDescription('stereotypePlate', translate('ko'), run)).toContain('6');
  });

  it('formats Chips, Mult, money, prices, and sell values through the 10m formatter', () => {
    expect(source('src/ui/components/Sidebar.tsx')).toContain('formatScore(chips)');
    expect(source('src/ui/components/Sidebar.tsx')).toContain('formatScore(mult)');
    expect(source('src/ui/components/MoneyValue.tsx')).toContain('formatScore(value)');
    expect(source('src/ui/components/MoneyValue.tsx')).toContain('formatScore(Math.abs(pop.delta))');
    expect(source('src/ui/components/Shop.tsx')).toContain('${formatScore(price)}');
    expect(source('src/ui/components/JokerShelf.tsx')).toContain('formatScore(consumableSellValue');
  });

  it('retains signed money motion and assigns distinct action colours', () => {
    const money = source('src/ui/components/MoneyValue.tsx');
    const shop = source('src/ui/components/Shop.tsx');
    const css = source('src/ui/styles/play.css');
    expect(money).toContain("pop.delta < 0 ? 'down' : 'up'");
    expect(css).toContain('.money-pop.up');
    expect(css).toContain('.money-pop.down');
    expect(shop).toContain('actionClassName="blue"');
    expect(shop).toContain('actionClassName="green"');
    expect(css).toMatch(/\.consumable-menu\.bare button\.use\s*\{[^}]*var\(--btn-green\)/s);
    expect(css).toMatch(/\.consumable-menu\.bare button\.sell\s*\{[^}]*var\(--mult\)/s);
  });

  it('allows a second selection click to deselect and preserves warning/spacing treatments', () => {
    const shop = source('src/ui/components/Shop.tsx');
    const css = source('src/ui/styles/play.css');
    expect(shop).toContain('setSelectedOffer((current) => current === key ? null : key)');
    expect(css).toMatch(/\.bonus-parts\s*\{[^}]*margin-top:\s*6px/s);
    expect(css).toMatch(/\.sb-status\.blocked\s*\{[^}]*color:\s*var\(--mult\)/s);
  });
});
