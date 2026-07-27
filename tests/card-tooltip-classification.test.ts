import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { consumableClassification } from '../src/ui/cardClassification';

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('card tooltip classification badges', () => {
  it('classifies the implemented consumable families without relabeling legacy ids', () => {
    expect(consumableClassification('fable1')).toBe('fable');
    expect(consumableClassification('libra')).toBe('constellation');
    expect(consumableClassification('magnifier')).toBeUndefined();
  });

  it('defines the four classification labels in both locales', () => {
    expect(en['tooltip.classification.voucher']).toBe('Voucher');
    expect(en['tooltip.classification.fable']).toBe('Fable');
    expect(en['tooltip.classification.constellation']).toBe('Constellation');
    expect(en['tooltip.classification.gambler']).toBe('Gambler');
    expect(ko['tooltip.classification.voucher']).toBe('바우처');
    expect(ko['tooltip.classification.fable']).toBe('우화');
    expect(ko['tooltip.classification.constellation']).toBe('별자리');
    expect(ko['tooltip.classification.gambler']).toBe('노름꾼');
  });

  it('renders classification as the shared tooltip footer badge', () => {
    const tooltip = source('../src/ui/components/Tooltip.tsx');
    const css = source('../src/ui/styles/screens.css');
    expect(tooltip).toContain('tt-classification');
    expect(tooltip).toContain('tooltip.classification.${classification}');
    expect(css).toContain('.tt-classification');
  });

  it('covers Collection, shop, held cards, pack choices, and Run Info', () => {
    const collection = source('../src/ui/components/Collection.tsx');
    expect(collection).toContain("classification={locked ? undefined : 'voucher'}");
    expect(collection).toContain('classification="fable"');
    expect(collection).toContain('classification="constellation"');
    expect(collection).toContain('classification="gambler"');

    expect(source('../src/ui/components/Shop.tsx')).toContain(
      'classification={m.classification}',
    );
    expect(source('../src/ui/components/JokerShelf.tsx')).toContain(
      'classification={consumableClassification(c)}',
    );
    expect(source('../src/ui/components/PackOpening.tsx')).toContain(
      'classification={tip.classification}',
    );
    expect(source('../src/ui/components/RunInfo.tsx')).toContain(
      'classification="voucher"',
    );
  });
});
