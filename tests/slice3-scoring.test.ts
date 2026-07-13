import { describe, it, expect } from 'vitest';
import { finalizeScore } from '../src/engine/patterns';
import { newRun } from '../src/engine/run';
import { BALANCE } from '../src/engine/balance';
import type { PatternId, SentenceJudgment, Suit } from '../src/engine/types';

const LV = (over: Partial<Record<PatternId, number>> = {}) => ({
  ...newRun('lv').patternLevels,
  ...over,
});

const jm = (
  pattern: PatternId,
  opts: { absorbed?: number; repeats?: number; unison?: Suit } = {},
): SentenceJudgment => ({
  match: {
    pattern,
    rank: BALANCE.patterns[pattern].rank,
    absorbedModifiers: opts.absorbed ?? 0,
    ...(opts.repeats !== undefined ? { repeats: opts.repeats } : {}),
  },
  unison: opts.unison ? { suit: opts.unison } : null,
});

describe('slice3 scoring — additive patterns fold to flat chips×mult (GDD §5.2, §7.3)', () => {
  it('Outcry: +20 chips ×1 = +20 flat', () => {
    expect(finalizeScore(0, jm('outcry'), LV()).total).toBe(20);
  });

  it('Imperative: 40 chips × 2 mult = +80 flat', () => {
    expect(finalizeScore(10, jm('imperative'), LV()).total).toBe(10 + 80);
  });

  it('Simple: 60 × 3 = +180 flat', () => {
    expect(finalizeScore(50, jm('simple'), LV()).total).toBe(50 + 180);
  });

  it('modifier absorption adds +15 chips each to additive patterns (GDD §5.1 rule 3)', () => {
    // Simple with 2 mods: (60 + 15·2) × 3 = 90 × 3 = 270
    expect(finalizeScore(0, jm('simple', { absorbed: 2 }), LV()).total).toBe(270);
  });

  it('Chant scales per repeat: (15·r) chips × (1.5·r) mult', () => {
    // r=3 → 45 × 4.5 = 202.5
    expect(finalizeScore(0, jm('chant', { repeats: 3 }), LV()).total).toBe(202.5);
  });
});

describe('slice3 scoring — multiplicative patterns multiply the total (GDD §7.3)', () => {
  it('Transitive ×2', () => {
    expect(finalizeScore(100, jm('transitive'), LV()).total).toBe(200);
  });

  it('Descriptive ×1.5', () => {
    expect(finalizeScore(100, jm('descriptive'), LV()).total).toBe(150);
  });

  it('Ditransitive ×2.5', () => {
    expect(finalizeScore(100, jm('ditransitive'), LV()).total).toBe(250);
  });

  it('Compound ×3', () => {
    expect(finalizeScore(100, jm('compound'), LV()).total).toBe(300);
  });

  it('modifier absorption adds +0.15 to the multiplier each (GDD §5.1 rule 3)', () => {
    // Transitive with 3 mods: ×(2 + 0.15·3) = ×2.45
    expect(finalizeScore(100, jm('transitive', { absorbed: 3 }), LV()).total).toBeCloseTo(245, 6);
  });
});

describe('slice3 scoring — Unison stacks on top (GDD §5.3)', () => {
  it('Standard unison adds +50 flat chips', () => {
    expect(finalizeScore(100, { match: null, unison: { suit: 'standard' } }, LV()).total).toBe(150);
  });

  it('Slang unison multiplies ×1.5', () => {
    expect(finalizeScore(100, { match: null, unison: { suit: 'slang' } }, LV()).total).toBe(150);
  });

  it('stacks a multiplicative pattern with a multiplicative unison', () => {
    // Transitive ×2 then slang unison ×1.5 → ×3
    expect(finalizeScore(100, jm('transitive', { unison: 'slang' }), LV()).total).toBe(300);
  });

  it('stacks an additive pattern flat with standard-unison flat', () => {
    // Imperative +80, standard unison +50 → (0+130)×1
    expect(finalizeScore(0, jm('imperative', { unison: 'standard' }), LV()).total).toBe(130);
  });
});

describe('slice3 scoring — punctuation levels (GDD §5.4) and no-match', () => {
  it('Imperative at level 2: (40+15) × (2+1) = 165', () => {
    expect(finalizeScore(0, jm('imperative'), LV({ imperative: 2 })).total).toBe(165);
  });

  it('Descriptive at level 2: ×(1.5 + 0.25) = ×1.75', () => {
    expect(finalizeScore(100, jm('descriptive'), LV({ descriptive: 2 })).total).toBeCloseTo(175, 6);
  });

  it('no pattern and no unison leaves the total unchanged', () => {
    const r = finalizeScore(42, { match: null, unison: null }, LV());
    expect(r.total).toBe(42);
    expect(r.flatBonus).toBe(0);
    expect(r.totalMultiplier).toBe(1);
  });
});
