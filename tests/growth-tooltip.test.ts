import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { stargazer } from '../src/engine/jokers/stargazer';
import { rhymeChain } from '../src/engine/jokers/rhymeChain';
import { grownValue } from '../src/ui/descriptions';
import { resolve, type Lang } from '../src/ui/i18n';

const t = (lang: Lang) => (key: string | string[], params?: Record<string, string | number>) =>
  resolve({ en, ko }, lang, key, params);

describe('scaling Emoji Tile tooltip value', () => {
  it('does not classify the blind-only Rhyme Chain streak as growth', () => {
    expect(grownValue(rhymeChain, undefined, t('ko'))).toBeNull();
  });

  it('shows the initial value before the first trigger and the live value afterward', () => {
    expect(grownValue(stargazer, { defId: stargazer.id, state: {} }, t('ko')))
      .toBe('(현재 [m:×1] 배수)');
    expect(grownValue(stargazer, { defId: stargazer.id, state: { factor: 1.3 } }, t('en')))
      .toBe('(Currently [m:×1.3] Mult)');
  });

  it('supports additive Chips growth with a +0 initial row', () => {
    const chipsGrowth = {
      ...stargazer,
      id: 'chipsGrowth',
      growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 } as const,
    };
    expect(grownValue(chipsGrowth, undefined, t('ko')))
      .toBe('(현재 [c:+0] 칩)');
  });
});
