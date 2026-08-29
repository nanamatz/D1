import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import type { Tile, WordSubmission } from '../src/engine/types';
import {
  crossedScoreTarget,
  SCORE_TYPEWRITER_KEYCAPS,
  scoreTypewriterBaseSuitMult,
  scoreTypewriterEventDelta,
  scoreTypewriterExpectedBase,
  scoreTypewriterKeySequence,
  scoreTypewriterKeyTiming,
  scoreTypewriterLiveTotal,
  scoreTypewriterShake,
  scoreTypewriterTier,
  type ScoreTypewriterTier,
} from '../src/ui/scoreTypewriter';

const tile = (id: string, letter: Tile['letter']): Tile => ({
  id,
  letter,
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
});

const submission = (patch: Partial<WordSubmission> = {}): WordSubmission => ({
  tiles: [tile('c', 'C'), tile('a', 'A'), tile('t', 'T')],
  text: 'CAT',
  isGibberish: false,
  suit: 'standard',
  posUsed: null,
  settledScore: 0,
  ...patch,
});

describe('Score Typewriter strength', () => {
  it('freezes expected base from letters, base suit, and scoring length with a floor', () => {
    expect(scoreTypewriterExpectedBase(submission({
      tiles: [tile('h1', 'H'), tile('i', 'I'), tile('g', 'G'), tile('h2', 'H')],
      text: 'HIGH',
    }), BALANCE.suitMult.standard)).toBe(165);
    expect(scoreTypewriterExpectedBase(submission({
      tiles: [tile('a', 'A')],
      text: 'A',
      scoringLength: 1,
    }), BALANCE.suitMult.standard)).toBe(BALANCE.scoreTypewriter.expectedBaseFloor);
    expect(scoreTypewriterExpectedBase(
      submission({ isGibberish: true, suit: null }),
      BALANCE.gibberish.mult,
    )).toBe(60);
    const stone = submission({
      tiles: [tile('stone', null)],
      text: '□',
      isGibberish: true,
      suit: null,
    });
    expect(scoreTypewriterExpectedBase(stone, BALANCE.gibberish.mult)).toBe(60);
    expect(scoreTypewriterTier(50, scoreTypewriterExpectedBase(
      stone,
      BALANCE.gibberish.mult,
    ))).toBe(2);
  });

  it('uses the original suit multiplier even when word rules rewrite the final suit', () => {
    const rewritten = submission({
      tiles: [tile('h1', 'H'), tile('i', 'I'), tile('g', 'G'), tile('h2', 'H')],
      text: 'HIGH',
      suit: 'vulgar',
    });
    const originalSuitEvent = [{
      kind: 'suit' as const,
      suit: 'standard' as const,
      mult: BALANCE.suitMult.standard,
    }];
    expect(scoreTypewriterExpectedBase(
      rewritten,
      scoreTypewriterBaseSuitMult(originalSuitEvent, BALANCE.suitMult.standard),
    )).toBe(165);
    expect(scoreTypewriterExpectedBase(
      rewritten,
      scoreTypewriterBaseSuitMult([], BALANCE.suitMult.standard),
    )).toBe(165);

    const gibberish = submission({
      tiles: Array.from({ length: 7 }, (_, index) => tile(`z${index}`, 'Z')),
      text: 'ZZZZZZZ',
      isGibberish: true,
      suit: null,
    });
    expect(scoreTypewriterExpectedBase(gibberish, BALANCE.suitMult.vulgar)).toBe(
      7 * (BALANCE.letterChips.Z ?? 0),
    );

    expect(scoreTypewriterBaseSuitMult([], BALANCE.suitMult.standard)).toBe(
      BALANCE.suitMult.standard,
    );
    expect(scoreTypewriterBaseSuitMult([], BALANCE.gibberish.mult)).toBe(
      BALANCE.gibberish.mult,
    );
  });

  it('uses the exact tier boundaries and keeps Tier 5 rare', () => {
    const base = 100;
    expect(scoreTypewriterTier(0, base)).toBe(0);
    expect(scoreTypewriterTier(24.999, base)).toBe(1);
    expect(scoreTypewriterTier(25, base)).toBe(2);
    expect(scoreTypewriterTier(99.999, base)).toBe(2);
    expect(scoreTypewriterTier(100, base)).toBe(3);
    expect(scoreTypewriterTier(-100, base)).toBe(3);
    expect(scoreTypewriterTier(300, base)).toBe(4);
    expect(scoreTypewriterTier(999.999, base)).toBe(4);
    expect(scoreTypewriterTier(1_000, base)).toBe(5);
  });

  it('measures unrounded local axes, includes flat score, and uses absolute magnitude', () => {
    expect(scoreTypewriterEventDelta(10, 2, 0, 10, 2.5, 7)).toBe(12);
    expect(scoreTypewriterEventDelta(10, 2, 0, 5, 2, 0)).toBe(10);
  });

  it('rejects non-finite values without consulting cumulative score or target', () => {
    expect(scoreTypewriterTier(Number.NaN, 60)).toBe(0);
    expect(scoreTypewriterTier(60, Number.POSITIVE_INFINITY)).toBe(0);
    expect(scoreTypewriterEventDelta(1, 1, 0, Number.NaN, 1, 0)).toBe(0);
  });

  it('classifies target crossing separately from the event tier', () => {
    expect(crossedScoreTarget(99, 100, 100)).toBe(true);
    expect(crossedScoreTarget(100, 120, 100)).toBe(false);
    expect(crossedScoreTarget(99, 99.9, 100)).toBe(false);
    expect(scoreTypewriterTier(1, 60)).toBe(1);
  });

  it('holds the pre-word total until settle activation and completion', () => {
    expect(scoreTypewriterLiveTotal(false, false, 90, 0, 0, 0, 140)).toBe(90);
    expect(scoreTypewriterLiveTotal(false, true, 90, 10, 2, 3, 140)).toBe(113);
    expect(scoreTypewriterLiveTotal(true, false, 90, 0, 0, 0, 140)).toBe(140);
  });

  it('authors 27 unlabeled caps and chooses a hashed unique permutation per beat', () => {
    expect(SCORE_TYPEWRITER_KEYCAPS).toHaveLength(27);
    expect(new Set(SCORE_TYPEWRITER_KEYCAPS.map(({ id }) => id)).size).toBe(27);
    expect(['a', 'b', 'c'].map((bank) =>
      SCORE_TYPEWRITER_KEYCAPS.filter(({ id }) => id.startsWith(bank)).length,
    )).toEqual([10, 9, 8]);
    for (const bank of ['a', 'b', 'c']) {
      const caps = SCORE_TYPEWRITER_KEYCAPS.filter(({ id }) => id.startsWith(bank));
      expect(new Set(caps.map(({ x }) => x)).size).toBeGreaterThan(1);
      expect(new Set(caps.map(({ scale }) => scale)).size).toBeGreaterThan(1);
      expect(new Set(caps.map(({ tilt }) => tilt)).size).toBeGreaterThan(1);
    }
    for (const cap of SCORE_TYPEWRITER_KEYCAPS) {
      expect(Object.keys(cap).sort()).toEqual(['id', 'scale', 'tilt', 'x', 'y']);
      expect(Number.isFinite(cap.x) && cap.x >= 0 && cap.x <= 100).toBe(true);
      expect(Number.isFinite(cap.y) && cap.y >= 0 && cap.y <= 100).toBe(true);
      expect(cap.scale).toBeGreaterThanOrEqual(0.9);
      expect(cap.scale).toBeLessThanOrEqual(1.1);
      expect(Math.abs(cap.tilt)).toBeLessThanOrEqual(4);
    }
    expect(BALANCE.scoreTypewriter.visualKeyCounts).toEqual([0, 3, 5, 8, 12, 16]);
    expect(BALANCE.scoreTypewriter.audibleKeyCounts).toEqual([0, 1, 2, 3, 4, 5]);
    const sequence = scoreTypewriterKeySequence('settle-42', 16);
    expect(scoreTypewriterKeySequence('settle-42', 16)).toEqual(sequence);
    expect(new Set(sequence).size).toBe(16);
    expect(sequence.every((index) => index >= 0 && index < 27)).toBe(true);
    expect(scoreTypewriterKeySequence('settle-42', 99)).toHaveLength(27);
    const fullSequence = scoreTypewriterKeySequence('settle-42', 27);
    expect(new Set(fullSequence.slice(1).map((value, index) =>
      (value - fullSequence[index]! + 27) % 27,
    )).size).toBeGreaterThan(1);
    expect(scoreTypewriterKeySequence('ab', 27)).not.toEqual(
      scoreTypewriterKeySequence('ba', 27),
    );
  });

  it('uses deterministic uneven gaps and finishes every key inside its score beat', () => {
    const tiers: ScoreTypewriterTier[] = [1, 2, 3, 4, 5];
    for (const speed of [1, 2, 4]) {
      for (const tier of tiers) {
        const count = BALANCE.scoreTypewriter.visualKeyCounts[tier];
        const timings = Array.from(
          { length: count },
          (_, index) => scoreTypewriterKeyTiming('settle-42', speed, tier, index, count),
        );
        const beatMs = BALANCE.scoreTypewriter.beatMs / speed;
        expect(new Set(timings.map(({ delayMs }) => delayMs)).size).toBe(count);
        expect(timings[0]!.delayMs).toBe(0);
        expect(timings.every((timing, index) =>
          index === 0 || timing.delayMs > timings[index - 1]!.delayMs,
        )).toBe(true);
        expect(timings.at(-1)!.delayMs + timings.at(-1)!.durationMs).toBeLessThanOrEqual(beatMs);
        expect(timings.every(({ durationMs }) => durationMs >= BALANCE.scoreTypewriter.keyPressFloorMs)).toBe(true);
        expect(Array.from(
          { length: count },
          (_, index) => scoreTypewriterKeyTiming('settle-42', speed, tier, index, count),
        )).toEqual(timings);
      }
    }
    const tierFive = Array.from(
      { length: BALANCE.scoreTypewriter.visualKeyCounts[5] },
      (_, index) => scoreTypewriterKeyTiming(
        'settle-42',
        1,
        5,
        index,
        BALANCE.scoreTypewriter.visualKeyCounts[5],
      ),
    );
    const gaps = tierFive.slice(1).map((timing, index) =>
      Number((timing.delayMs - tierFive[index]!.delayMs).toFixed(6)),
    );
    expect(new Set(gaps).size).toBeGreaterThan(1);
    expect(BALANCE.scoreTypewriter.keyRhythmJitter).toBe(0.35);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThanOrEqual(
      (1 + BALANCE.scoreTypewriter.keyRhythmJitter) /
      (1 - BALANCE.scoreTypewriter.keyRhythmJitter),
    );
    expect(BALANCE.scoreTypewriter.keyPressMs).toEqual([0, 96, 88, 76, 64, 56]);
  });

  it('normalizes screen shake and scales it monotonically by event tier', () => {
    expect(scoreTypewriterShake(0, 5)).toBe(0);
    expect(scoreTypewriterShake(50, 5)).toBe(0.5);
    expect(scoreTypewriterShake(100, 0)).toBe(0);
    expect(scoreTypewriterShake(100, 1)).toBe(0);
    expect(scoreTypewriterShake(100, 2)).toBe(0.2);
    expect(scoreTypewriterShake(100, 3)).toBe(0.45);
    expect(scoreTypewriterShake(100, 4)).toBe(0.7);
    expect(scoreTypewriterShake(100, 5)).toBe(1);
    expect(scoreTypewriterShake(200, 5)).toBe(1);
  });
});
