import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../src/engine/types';
import {
  consumableAxisTip,
  consumableTooltipBody,
  consumableTooltipExtra,
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
    });
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
