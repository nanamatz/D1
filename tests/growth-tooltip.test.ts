import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { BALANCE } from '../src/engine/balance';
import { stargazer } from '../src/engine/jokers/stargazer';
import { pouchTag } from '../src/engine/jokers/pouchTag';
import { rhymeChain } from '../src/engine/jokers/rhymeChain';
import { discardedDraft } from '../src/engine/jokers/discardedDraft';
import { outOfPrint } from '../src/engine/jokers/outOfPrint';
import { bloodTypeA } from '../src/engine/jokers/bloodTypeA';
import { dryingInk } from '../src/engine/jokers/dryingInk';
import { foldingManuscript } from '../src/engine/jokers/foldingManuscript';
import { dullingPencil } from '../src/engine/jokers/dullingPencil';
import { handScholar } from '../src/engine/jokers/handScholar';
import { blacksmith } from '../src/engine/jokers/blacksmith';
import { newRun } from '../src/engine/run';
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

  it('shows a decaying value below its initial value', () => {
    expect(grownValue(dryingInk, {
      defId: dryingInk.id,
      state: { mult: BALANCE.jokers.dryingInk.mult - 1 },
    }, t('en'))).toBe('(Currently [m:+14] Mult)');
    expect(grownValue(dullingPencil, {
      defId: dullingPencil.id,
      state: { chips: 95 },
    }, t('en'))).toBe('(Currently [c:+95] Chips)');
  });

  it('shows Folding Manuscript current hand size', () => {
    expect(grownValue(foldingManuscript, {
      defId: foldingManuscript.id,
      state: { handSize: 1 },
    }, t('ko'))).toBe('(현재 [p:+1 핸드 크기])');
  });

  it('shows Hand Scholar ×Mult from the run-wide Word Hand ledger', () => {
    const run = newRun('hand-scholar-tooltip');
    run.playedLetterHands = ['twin', 'straight'];
    expect(grownValue(handScholar, {
      defId: handScholar.id,
      state: {},
    }, t('en'), undefined, run)).toBe('(Currently [m:×2] Mult)');
  });

  it('supports additive Chips growth with a +0 initial row', () => {
    const chipsGrowth = {
      ...stargazer,
      id: 'chipsGrowth',
      growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 } as const,
    };
    expect(grownValue(chipsGrowth, undefined, t('ko')))
      .toBe('(현재 [c:+0] 칩)');
    expect(grownValue(bloodTypeA, { defId: bloodTypeA.id, state: { chips: 24 } }, t('ko')))
      .toBe('(현재 [c:+24] 칩)');
    expect(grownValue(blacksmith, undefined, t('en')))
      .toBe('(Currently [c:+0] Chips)');
  });

  it('shows Pouch Tag Chips from the live remaining-tile count', () => {
    expect(grownValue(pouchTag, undefined, t('ko'), 17))
      .toBe('(현재 [c:+15] 칩)');
    expect(grownValue(pouchTag, undefined, t('en'), 4))
      .toBe('(Currently [c:+0] Chips)');
  });

  it('shows Discarded Draft and Out of Print current values', () => {
    expect(grownValue(discardedDraft, {
      defId: discardedDraft.id, state: { chips: 12 },
    }, t('en'))).toBe('(Currently [c:+12] Chips)');

    const run = newRun('out-of-print-tooltip');
    run.bag = run.bag.filter((tile) => tile.letter !== 'Q' && tile.letter !== 'Z');
    expect(grownValue(outOfPrint, { defId: outOfPrint.id, state: {} }, t('ko'), undefined, run))
      .toBe('(현재 [c:+100] 칩 및 [m:+16] 배수)');
  });
});
