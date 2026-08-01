import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import type { RunState } from '../src/engine/types';
import {
  consumableAxisTip,
  consumableTooltipBody,
  consumableTooltipExtra,
  referencedEditionTips,
  referencedFontTips,
} from '../src/ui/descriptions';

const t = (key: string | string[], params?: Record<string, string | number>): string => {
  let value = Array.isArray(key) ? key[0]! : key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
};

describe('shared consumable tooltip copy', () => {
  it('uses one contextual body for every Constellation surface', () => {
    expect(consumableTooltipBody('sagittarius', t)).toBe('pack.constellationLevels');
    expect(consumableTooltipBody('fable17', t)).toBe('consumabledesc.fable17');
  });

  it('derives material sub-tooltips from the Fable registry', () => {
    expect(consumableAxisTip('fable4', t)).toEqual({
      title: 'material.leadPlate',
      body: 'materialdesc.leadPlate',
      kind: 'material',
    });
  });

  it('derives font sub-tooltips from any effect description that names a font', () => {
    const translate = (dict: Record<string, string>) => (key: string | string[]) =>
      dict[Array.isArray(key) ? key[0]! : key] ?? (Array.isArray(key) ? key[0]! : key);
    const koT = translate(ko);
    const enT = translate(en);

    expect(referencedFontTips(ko['consumabledesc.barnSwallow'], koT)).toEqual([{
      title: ko['font.black'],
      body: ko['fonteffectdesc.retriggerPlay'],
      kind: 'font',
    }]);
    expect(referencedFontTips(en['jokerdesc.lightTouch'], enT)).toEqual([{
      title: en['font.lightItalic'],
      body: en['fonteffectdesc.goldPlay'],
      kind: 'font',
    }]);
    expect(referencedFontTips(en['pouch.military.desc'], enT)).toEqual([]);
    expect(readFileSync('src/ui/components/Tooltip.tsx', 'utf8')).toContain('referencedFontTips');
  });

  it('derives edition sub-tooltips only from explicitly marked edition names', () => {
    const translate = (dict: Record<string, string>) => (key: string | string[]) =>
      dict[Array.isArray(key) ? key[0]! : key] ?? (Array.isArray(key) ? key[0]! : key);
    const enT = translate(en);
    const koT = translate(ko);

    expect(referencedEditionTips(en['consumabledesc.fable15'], enT)).toEqual([
      { title: en['edition.gray'], body: en['editiondesc.gray'], kind: 'edition' },
      { title: en['edition.violet'], body: en['editiondesc.violet'], kind: 'edition' },
      { title: en['edition.rainbow'], body: en['editiondesc.rainbow'], kind: 'edition' },
    ]);
    expect(referencedEditionTips(ko['skipReward.whiteTag.desc'], koT)).toEqual([
      { title: ko['edition.white'], body: ko['editiondesc.white'], kind: 'edition' },
    ]);
    expect(referencedEditionTips(en['pouch.military.desc'], enT)).toEqual([]);
  });

  it('provides the live Fable 17 value only when applicable', () => {
    const run = { jokers: [] } as unknown as RunState;
    expect(consumableTooltipExtra('fable17', run, t)).toBe('consumable.currentSellValue');
    expect(consumableTooltipExtra('fable4', run, t)).toBeNull();
  });

  it('routes every consumable-rendering surface through the shared helpers', () => {
    const files = [
      'src/ui/components/Shop.tsx',
      'src/ui/components/JokerShelf.tsx',
      'src/ui/components/PackOpening.tsx',
      'src/ui/components/Collection.tsx',
    ];
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).toContain('consumableTooltipBody');
    }
  });
});
