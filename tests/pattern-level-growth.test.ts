import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { patternChipsMult } from '../src/engine/patterns';
import { patternLevelTone } from '../src/ui/patternLevel';

describe('sentence-pattern level growth', () => {
  it('uses fixed Chips increments and +1 Mult per level', () => {
    expect(BALANCE.patternLevelGrowthFactor).toBe(1);
    expect(BALANCE.patterns.simple).toMatchObject({ levelChips: 30, levelMult: 1 });
    expect(patternChipsMult('simple', 3)).toEqual({ chips: 100, mult: 4 });
  });

  it('keeps every level value and level-up delta a natural number', () => {
    const base = BALANCE.patterns.simple;
    const one = patternChipsMult('simple', 1);
    const two = patternChipsMult('simple', 2);
    const three = patternChipsMult('simple', 3);

    expect(one).toEqual({ chips: base.baseChips, mult: base.baseMult });
    expect(two.chips - one.chips).toBe(base.levelChips);
    expect(two.mult - one.mult).toBe(base.levelMult);
    expect(three.chips - two.chips).toBe(base.levelChips);
    expect(three.mult - two.mult).toBe(base.levelMult);

    for (const id of Object.keys(BALANCE.patterns) as (keyof typeof BALANCE.patterns)[]) {
      let previous = patternChipsMult(id, 1);
      for (let level = 1; level <= 32; level += 1) {
        const current = patternChipsMult(id, level);
        expect(Number.isInteger(current.chips)).toBe(true);
        expect(Number.isInteger(current.mult)).toBe(true);
        expect(current.chips).toBeGreaterThan(0);
        expect(current.mult).toBeGreaterThan(0);
        if (level > 1) {
          expect(current.chips - previous.chips).toBeGreaterThanOrEqual(1);
          expect(current.mult - previous.mult).toBeGreaterThanOrEqual(1);
        }
        previous = current;
      }
    }
  });

  it('uses the requested six level-colour bands', () => {
    expect([1, 3, 4, 5, 6, 8, 9, 12, 13, 16, 17].map(patternLevelTone)).toEqual([
      'yellow', 'yellow', 'orange', 'orange', 'green', 'green',
      'blue', 'blue', 'purple', 'purple', 'red',
    ]);
  });
});
