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

// Every sentence adds its Chips to the committed blind score, then multiplies
// that combined axis by sentence Mult.
//   final = (committed + patternChips + 15·mods + unisonChips)
//         × (patternMult × unisonMult)

describe('slice3 scoring — pattern Chips add, then pattern Mult multiplies (GDD §5.2)', () => {
  it('Outcry: 25 × 1 = +25', () => {
    expect(finalizeScore(0, jm('outcry'), LV()).total).toBe(25);
  });

  it('Imperative: (10 + 40) × 1 = 50', () => {
    expect(finalizeScore(10, jm('imperative'), LV()).total).toBe(50);
  });

  it('Simple: (50 + 35) × 1 = 85', () => {
    expect(finalizeScore(50, jm('simple'), LV()).total).toBe(85);
  });

  it('Transitive: (100 + 50) × 2 = 300', () => {
    expect(finalizeScore(100, jm('transitive'), LV()).total).toBe(300);
  });

  it('Descriptive: (100 + 75) × 3 = 525', () => {
    expect(finalizeScore(100, jm('descriptive'), LV()).total).toBe(525);
  });

  it('Ditransitive: (100 + 135) × 3 = 705', () => {
    expect(finalizeScore(100, jm('ditransitive'), LV()).total).toBe(705);
  });

  it('Compound: (100 + 165) × 4 = 1060', () => {
    expect(finalizeScore(100, jm('compound'), LV()).total).toBe(1060);
  });

  it('Object Complement: 115 × 3 = +345', () => {
    expect(finalizeScore(0, jm('objectComplement'), LV()).total).toBe(345);
  });

  it('Interrogative: 60 × 2 = +120', () => {
    expect(finalizeScore(0, jm('interrogative'), LV()).total).toBe(120);
  });

  it('Negative: 55 × 2 = +110', () => {
    expect(finalizeScore(0, jm('negative'), LV()).total).toBe(110);
  });

  it('Complex: 195 × 4 = +780', () => {
    expect(finalizeScore(0, jm('complex'), LV()).total).toBe(780);
  });
});

describe('slice3 scoring — modifiers add +15 chips each, uniformly (GDD §5.1 rule 3)', () => {
  it('Simple with 2 mods: (35 + 15·2) × 1 = 65', () => {
    expect(finalizeScore(0, jm('simple', { absorbed: 2 }), LV()).total).toBe(65);
  });

  it('Transitive with 3 mods: (50 + 15·3) × 2 = 190', () => {
    expect(finalizeScore(0, jm('transitive', { absorbed: 3 }), LV()).total).toBe(190);
  });
});

describe('slice3 scoring — Chant repeat bonus (GDD §5.2)', () => {
  it('exactly 2 repeats: base 90 × 3 = 270 (no repeat bonus yet)', () => {
    expect(finalizeScore(0, jm('chant', { repeats: 2 }), LV()).total).toBe(270);
  });

  it('4 repeats: +10 chips per repeat beyond the 2nd → (90 + 10·2) × 3 = 330', () => {
    expect(finalizeScore(0, jm('chant', { repeats: 4 }), LV()).total).toBe(330);
  });
});

describe('slice3 scoring — Unison folds into the formula (GDD §5.3)', () => {
  it('Standard unison adds +50 to the Chips side', () => {
    expect(finalizeScore(100, { match: null, unison: { suit: 'standard' } }, LV()).total).toBe(150);
  });

  it('Slang unison alone multiplies the committed score', () => {
    const result = finalizeScore(100, { match: null, unison: { suit: 'slang' } }, LV());
    expect(result.total).toBe(150);
    expect(result.bonus).toBe(50);
  });

  it('Transitive × Slang unison: (100 + 50) × (2 × 1.5) = 450', () => {
    expect(finalizeScore(100, jm('transitive', { unison: 'slang' }), LV()).total).toBe(450);
  });

  it('Imperative + Standard unison: (40 + 50) × 1 = 90', () => {
    expect(finalizeScore(0, jm('imperative', { unison: 'standard' }), LV()).total).toBe(90);
  });
});

describe('slice3 scoring — leveling raises both Chips and Mult (GDD §5.4)', () => {
  it('Imperative at level 2: (40+15) × (1+1) = 110', () => {
    expect(finalizeScore(0, jm('imperative'), LV({ imperative: 2 })).total).toBe(110);
  });

  it('Descriptive at level 2: (100 + 75+30) × (3+1) = 820', () => {
    expect(finalizeScore(100, jm('descriptive'), LV({ descriptive: 2 })).total).toBe(820);
  });

  it('no pattern and no unison leaves the total unchanged', () => {
    const r = finalizeScore(42, { match: null, unison: null }, LV());
    expect(r.total).toBe(42);
    expect(r.sentenceChips).toBe(0);
    expect(r.sentenceMult).toBe(1);
    expect(r.bonus).toBe(0);
  });
});
