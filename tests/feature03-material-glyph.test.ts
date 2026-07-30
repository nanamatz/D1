/**
 * feature-03 B-1 — conditional-material corner glyph + Wood live growth counter.
 * The glyph is the "why is this tile special" read without a tooltip (UI_DESIGN §3.1 ②).
 */
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
  it('shows a corner glyph only for conditional materials', () => {
    expect(materialGlyph(tile('glass'))).not.toBeNull();
    expect(materialGlyph(tile('leadPlate'))).not.toBeNull();
    expect(materialGlyph(tile('ivory'))).toBe('$');
    expect(materialGlyph(tile('brass'))).not.toBeNull();
  });

  it('returns null for base and flat materials (no condition to advertise)', () => {
    for (const m of ['ceramic', 'porcelain', 'polished', 'stone'] as const) {
      expect(materialGlyph(tile(m))).toBeNull();
    }
  });

  it('Wood shows its LIVE growth counter, climbing with woodBonusChips', () => {
    expect(materialGlyph(tile('wood'))).toBe(`+${BALANCE.materials.wood.baseChips}`);
    const grown = tile('wood', { woodBonusChips: BALANCE.materials.wood.baseChips + 20 });
    expect(materialGlyph(grown)).toBe(`+${BALANCE.materials.wood.baseChips + 20}`);
  });
});
