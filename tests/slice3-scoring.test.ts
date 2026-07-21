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

// feature-02 A: every pattern is a self-contained [base Chips × Mult] bonus ADDED
// to the committed total — patterns no longer multiply the running word score.
//   sentence bonus = (patternChips + 15·mods + unisonChips) × (patternMult × unisonMult)

describe('slice3 scoring — base pattern Chips × Mult, added to the total (GDD §5.2)', () => {
  it('Outcry: 10 × 1 = +10', () => {
    expect(finalizeScore(0, jm('outcry'), LV()).total).toBe(10);
  });

  it('Imperative: 15 × 2 = +30 (added onto totalBefore)', () => {
    expect(finalizeScore(10, jm('imperative'), LV()).total).toBe(10 + 30);
  });

  it('Simple: 25 × 2 = +50', () => {
    expect(finalizeScore(50, jm('simple'), LV()).total).toBe(50 + 50);
  });

  it('Transitive: 40 × 3 = +120', () => {
    expect(finalizeScore(100, jm('transitive'), LV()).total).toBe(100 + 120);
  });

  it('Descriptive: 30 × 3 = +90', () => {
    expect(finalizeScore(100, jm('descriptive'), LV()).total).toBe(100 + 90);
  });

  it('Ditransitive: 50 × 4 = +200', () => {
    expect(finalizeScore(100, jm('ditransitive'), LV()).total).toBe(100 + 200);
  });

  it('Compound: 60 × 4 = +240', () => {
    expect(finalizeScore(100, jm('compound'), LV()).total).toBe(100 + 240);
  });
});

describe('slice3 scoring — modifiers add +15 chips each, uniformly (GDD §5.1 rule 3)', () => {
  it('Simple with 2 mods: (25 + 15·2) × 2 = 110', () => {
    expect(finalizeScore(0, jm('simple', { absorbed: 2 }), LV()).total).toBe(110);
  });

  it('Transitive with 3 mods: (40 + 15·3) × 3 = 255', () => {
    expect(finalizeScore(0, jm('transitive', { absorbed: 3 }), LV()).total).toBe(255);
  });
});

describe('slice3 scoring — Chant repeat bonus (GDD §5.2)', () => {
  it('exactly 3 repeats: base 15 × 2 = 30 (no repeat bonus yet)', () => {
    expect(finalizeScore(0, jm('chant', { repeats: 3 }), LV()).total).toBe(30);
  });

  it('5 repeats: +10 chips per repeat beyond the 3rd → (15 + 10·2) × 2 = 70', () => {
    expect(finalizeScore(0, jm('chant', { repeats: 5 }), LV()).total).toBe(70);
  });
});

describe('slice3 scoring — Unison folds into the formula (GDD §5.3)', () => {
  it('Standard unison adds +50 to the Chips side', () => {
    expect(finalizeScore(100, { match: null, unison: { suit: 'standard' } }, LV()).total).toBe(150);
  });

  it('Slang unison alone (no pattern chips to multiply) adds nothing', () => {
    // (0) × 1.5 = 0 — register mults only amplify the Chips side (changed from the
    // old scheme where unison multiplied the whole committed total).
    expect(finalizeScore(100, { match: null, unison: { suit: 'slang' } }, LV()).total).toBe(100);
  });

  it('Transitive × Slang unison: 40 × (3 × 1.5) = 180', () => {
    expect(finalizeScore(100, jm('transitive', { unison: 'slang' }), LV()).total).toBe(100 + 180);
  });

  it('Imperative + Standard unison: (15 + 50) × 2 = 130', () => {
    expect(finalizeScore(0, jm('imperative', { unison: 'standard' }), LV()).total).toBe(130);
  });
});

describe('slice3 scoring — leveling raises both Chips and Mult (GDD §5.4)', () => {
  it('Imperative at level 2: (15+10) × (2+0.5) = 62.5', () => {
    expect(finalizeScore(0, jm('imperative'), LV({ imperative: 2 })).total).toBe(62.5);
  });

  it('Descriptive at level 2: (30+15) × (3+1) = 180', () => {
    expect(finalizeScore(100, jm('descriptive'), LV({ descriptive: 2 })).total).toBe(100 + 180);
  });

  it('no pattern and no unison leaves the total unchanged', () => {
    const r = finalizeScore(42, { match: null, unison: null }, LV());
    expect(r.total).toBe(42);
    expect(r.sentenceChips).toBe(0);
    expect(r.sentenceMult).toBe(1);
    expect(r.bonus).toBe(0);
  });
});
