/**
 * feature-04 A — audio manifest coverage. A-2 (every material has a voice, mapped
 * in the facade with a real recipe) and A-1/A-3/A-4 (the new names exist and are
 * audible). Pure/headless: play() no-ops in Node, so we assert the MAP + RECIPES,
 * which is what "wired centrally, never call-site branching" actually means.
 */
import { describe, it, expect } from 'vitest';
import { MATERIAL_SFX, SFX_NAMES, effectiveGain, type SfxName } from '../src/ui/audio';

const FULL = { master: 100, music: 100, sfx: 100 };
// The 9 engine TileMaterial values (types.ts) — kept in step by this test.
const MATERIALS = [
  'ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass', 'wood',
] as const;

describe('feature-04 A-2 — per-material tile voices', () => {
  it('every TileMaterial maps to a real, audible SFX recipe (nothing silent)', () => {
    for (const m of MATERIALS) {
      const sfx = MATERIAL_SFX[m];
      expect(sfx, `material ${m} has a voice`).toBeTruthy();
      expect(SFX_NAMES).toContain(sfx);
      expect(effectiveGain(sfx as SfxName, FULL)).toBeGreaterThan(0);
    }
  });

  it('distinguishes the materials the playtest called out', () => {
    // Glass rings, Stone knocks, Brass rings bright, Wood is its own knock — not all
    // collapsed onto one sample. Ceramic/Porcelain intentionally share the clink.
    expect(new Set(MATERIALS.map((m) => MATERIAL_SFX[m])).size).toBeGreaterThanOrEqual(7);
    expect(MATERIAL_SFX.ceramic).toBe(MATERIAL_SFX.porcelain);
  });
});

describe('feature-04 A-1/A-3/A-4 — new manifest entries exist and are audible', () => {
  it('money, object and pack sounds are present', () => {
    for (const n of ['coinGain', 'coinLoss', 'consumableUse', 'packPick', 'matGlassBreak', 'matDiceRattle'] as SfxName[]) {
      expect(SFX_NAMES).toContain(n);
      expect(effectiveGain(n, FULL)).toBeGreaterThan(0);
    }
  });
});
