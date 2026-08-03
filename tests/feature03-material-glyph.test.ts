/**
 * Material face details + Wood live growth counter.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { materialGlyph } from '../src/ui/game';
import { BALANCE } from '../src/engine/balance';
import type { Tile, TileMaterial } from '../src/engine/types';

const tile = (material: TileMaterial, extra: Partial<Tile> = {}): Tile => ({
  id: 't',
  letter: 'A',
  material,
  font: 'medium',
  ...extra,
});

describe('materialGlyph (B-1)', () => {
  it('omits corner symbols from every material except Wood', () => {
    for (const m of ['ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass'] as const) {
      expect(materialGlyph(tile(m))).toBeNull();
    }
  });

  it('Wood shows its LIVE growth counter, climbing with woodBonusChips', () => {
    expect(materialGlyph(tile('wood'))).toBe(`+${BALANCE.materials.wood.baseChips}`);
    const grown = tile('wood', { woodBonusChips: BALANCE.materials.wood.baseChips + 20 });
    expect(materialGlyph(grown)).toBe(`+${BALANCE.materials.wood.baseChips + 20}`);
  });
});

describe('material tile silhouette', () => {
  const css = readFileSync('src/ui/styles/play.css', 'utf8');

  it('keeps every material on the Ceramic border and radius', () => {
    expect(css).toMatch(/\.tile\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*10px/s);
    for (const material of ['glass', 'stone', 'porcelain', 'polished', 'leadPlate', 'ivory', 'brass', 'wood']) {
      const block = css.match(new RegExp(`\\.tile\\.${material}\\s*\\{([^}]*)}`))?.[1] ?? '';
      expect(block, material).not.toMatch(/\bborder(?:-radius)?:/);
    }
  });

  it('keeps score corners clear and colours Wood growth as Chips', () => {
    const lead = css.match(/\.tile\.leadPlate \.tile-material-texture\s*\{([^}]*)}/s)?.[1] ?? '';
    expect(lead).not.toContain('radial-gradient');
    expect(css).toMatch(/\.tile\.porcelain \.tile-material-texture\s*\{[^}]*circle at 0 100%[^}]*circle at 100% 0/s);
    expect(css).toMatch(/\.mat-glyph\.mat-glyph-wood\s*\{[^}]*color:\s*var\(--chips\)/s);
  });
});
