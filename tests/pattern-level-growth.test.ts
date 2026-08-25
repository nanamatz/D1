import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { patternChipsMult } from '../src/engine/patterns';
import { patternLevelTone } from '../src/ui/patternLevel';

describe('sentence-pattern level growth', () => {
  it('uses fixed Chips increments and +1 Mult per level', () => {
    expect(BALANCE.patternLevelGrowthFactor).toBe(1);
    expect(BALANCE.patterns.simple).toMatchObject({
      difficulty: 'easy', levelChips: 15, levelMult: 1,
    });
    expect(patternChipsMult('simple', 3)).toEqual({ chips: 65, mult: 3 });
  });

  it('classifies construction difficulty independently from payout rank', () => {
    expect(Object.entries(BALANCE.patterns).reduce<Record<string, string[]>>(
      (groups, [id, pattern]) => {
        (groups[pattern.difficulty] ??= []).push(id);
        return groups;
      },
      {},
    )).toEqual({
      easy: ['outcry', 'simple', 'imperative', 'interrogative'],
      medium: ['transitive', 'negative', 'descriptive'],
      hard: ['chant', 'objectComplement', 'ditransitive', 'compound', 'complex'],
    });
  });

  it('uses the tier Chips slope while keeping Mult growth uniform', () => {
    for (const pattern of Object.values(BALANCE.patterns)) {
      expect(pattern.levelChips).toBe(
        BALANCE.patternDifficultyLevelChips[pattern.difficulty],
      );
      expect(pattern.levelMult).toBe(1);
    }
  });

  it('keeps representative Easy/Medium/Hard curves at Lv1, Lv5, and Lv10', () => {
    expect([1, 5, 10].map((level) => patternChipsMult('outcry', level))).toEqual([
      { chips: 25, mult: 1 },
      { chips: 85, mult: 5 },
      { chips: 160, mult: 10 },
    ]);
    expect([1, 5, 10].map((level) => patternChipsMult('descriptive', level))).toEqual([
      { chips: 75, mult: 3 },
      { chips: 195, mult: 7 },
      { chips: 345, mult: 12 },
    ]);
    expect([1, 5, 10].map((level) => patternChipsMult('complex', level))).toEqual([
      { chips: 195, mult: 4 },
      { chips: 375, mult: 8 },
      { chips: 600, mult: 13 },
    ]);
  });

  it('lets sustained Easy investment overtake base Complex without doing so immediately', () => {
    const firstLevelAtLeast = (id: keyof typeof BALANCE.patterns, committed: number) => {
      const complex = patternChipsMult('complex', 1);
      const targetBonus = (committed + complex.chips) * complex.mult - committed;
      for (let level = 1; level <= 32; level += 1) {
        const current = patternChipsMult(id, level);
        const bonus = (committed + current.chips) * current.mult - committed;
        if (bonus >= targetBonus) return level;
      }
      return null;
    };

    expect(firstLevelAtLeast('outcry', BALANCE.anteBaseTargets[0])).toBe(6);
    expect(firstLevelAtLeast('imperative', BALANCE.anteBaseTargets[0])).toBe(5);
    expect(firstLevelAtLeast('simple', BALANCE.anteBaseTargets[0])).toBe(6);
    expect(firstLevelAtLeast('outcry', BALANCE.anteBaseTargets.at(-1)!)).toBe(5);
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

  it('uses the requested seven level-colour bands', () => {
    expect([1, 2, 3, 4, 5, 6, 8, 9, 12, 13, 16, 17].map(patternLevelTone)).toEqual([
      'white', 'yellow', 'yellow', 'orange', 'orange', 'green', 'green',
      'blue', 'blue', 'purple', 'purple', 'red',
    ]);
  });
});
