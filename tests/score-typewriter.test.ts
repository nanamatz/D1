import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import {
  crossedScoreTarget,
  SCORE_TYPEWRITER_KEYCAPS,
  scoreTypewriterClearPeak,
  scoreTypewriterClearRepeatMs,
  scoreTypewriterEventDelta,
  scoreTypewriterKeySequence,
  scoreTypewriterKeyTiming,
  scoreTypewriterLiveTotal,
  scoreTypewriterPeakTier,
  scoreTypewriterPrimaryKey,
  scoreTypewriterShake,
  scoreTypewriterTier,
  scheduleScoreTypewriterClearRepeats,
  type ScoreTypewriterTier,
} from '../src/ui/scoreTypewriter';

describe('Score Typewriter strength', () => {
  it('uses the approved 1.0–1.5 target-ratio boundaries', () => {
    const target = 100;
    expect(BALANCE.scoreTypewriter.ratioThresholds).toEqual([1, 1.1, 1.2, 1.3, 1.4, 1.5]);
    expect(scoreTypewriterTier(99.999, target)).toBe(0);
    expect(scoreTypewriterTier(100, target)).toBe(1);
    expect(scoreTypewriterTier(109.999, target)).toBe(1);
    expect(scoreTypewriterTier(110, target)).toBe(2);
    expect(scoreTypewriterTier(119.999, target)).toBe(2);
    expect(scoreTypewriterTier(120, target)).toBe(3);
    expect(scoreTypewriterTier(129.999, target)).toBe(3);
    expect(scoreTypewriterTier(130, target)).toBe(4);
    expect(scoreTypewriterTier(139.999, target)).toBe(4);
    expect(scoreTypewriterTier(140, target)).toBe(5);
    expect(scoreTypewriterTier(149.999, target)).toBe(5);
    expect(scoreTypewriterTier(150, target)).toBe(6);
    expect(scoreTypewriterTier(200, target)).toBe(6);
  });

  it('classifies the supplied score / target ratio', () => {
    expect(scoreTypewriterTier(150, 100)).toBe(6);
    expect(scoreTypewriterTier(1_500_000, 1_000_000)).toBe(6);
    expect(scoreTypewriterTier(0, 100)).toBe(0); // debuffed submission
    expect(scoreTypewriterTier(101, 100)).toBe(1); // gibberish may qualify
  });

  it('makes higher submission ratios denser, faster, and stronger', () => {
    const tiers = [1, 2, 3, 4, 5, 6] as const;
    const ratios = [1, 1.1, 1.2, 1.3, 1.4, 1.5];
    expect(ratios.map((ratio) => scoreTypewriterTier(ratio * 100, 100))).toEqual(tiers);
    for (let index = 1; index < tiers.length; index += 1) {
      const previous = tiers[index - 1]!;
      const current = tiers[index]!;
      expect(BALANCE.scoreTypewriter.visualKeyCounts[current])
        .toBeGreaterThan(BALANCE.scoreTypewriter.visualKeyCounts[previous]);
      expect(BALANCE.scoreTypewriter.audibleKeyCounts[current])
        .toBeGreaterThan(BALANCE.scoreTypewriter.audibleKeyCounts[previous]);
      expect(BALANCE.scoreTypewriter.keyPressMs[current])
        .toBeLessThan(BALANCE.scoreTypewriter.keyPressMs[previous]);
      expect(scoreTypewriterShake(100, current))
        .toBeGreaterThanOrEqual(scoreTypewriterShake(100, previous));
    }
  });

  it('measures only positive increases in the unrounded local subtotal', () => {
    expect(scoreTypewriterEventDelta(10, 2, 0, 10, 2.5, 7)).toBe(12);
    expect(scoreTypewriterEventDelta(10, 2, 0, 5, 2, 0)).toBe(0);
    expect(scoreTypewriterEventDelta(-10, 1, 0, -5, 1, 0)).toBe(0);
  });

  it('raises a settle-local peak through the approved progressive trace', () => {
    const trace = [99, 100, 109.9, 110, 120, 115, 130, 140, 150];
    let previousLocal = 0;
    let peak: ScoreTypewriterTier = 0;
    const tiers = trace.map((local) => {
      peak = scoreTypewriterPeakTier(peak, previousLocal, local, 100);
      previousLocal = local;
      return peak;
    });
    expect(tiers).toEqual([0, 1, 1, 2, 3, 3, 4, 5, 6]);
    expect(scoreTypewriterPeakTier(3, 100, 80, 100)).toBe(3);
    expect(scoreTypewriterPeakTier(3, 100, Number.NaN, 100)).toBe(3);
    expect(scoreTypewriterPeakTier(0, 0, 1_000, 0)).toBe(0);
    expect(scoreTypewriterPeakTier(0, 0, 1_000, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('adds visible sentence projection only after a positive local beat', () => {
    expect(scoreTypewriterPeakTier(0, 0, 150, 740, 590)).toBe(1);
    expect(scoreTypewriterPeakTier(0, 0, 90, 800, 1_110)).toBe(6);
    expect(scoreTypewriterPeakTier(0, 0, 0, 100, 500)).toBe(0);
    expect(scoreTypewriterPeakTier(2, 20, 10, 100, 500)).toBe(2);
    expect(scoreTypewriterPeakTier(0, 0, 10, 100, Number.NaN)).toBe(0);
  });

  it('resets normal/cashout lifecycle while retaining a clear peak through resolution', () => {
    expect(scoreTypewriterClearPeak(0, false, false, 0)).toBe(0);
    const clearPeak = scoreTypewriterClearPeak(0, true, true, 3);
    expect(clearPeak).toBe(3);
    expect(scoreTypewriterClearPeak(clearPeak, true, false, 0)).toBe(3);
    expect(scoreTypewriterClearPeak(clearPeak, false, false, 0)).toBe(0);

    const finalPhaseLossResolution = true && 90 >= 100;
    expect(finalPhaseLossResolution).toBe(false);
    expect(scoreTypewriterClearPeak(3, finalPhaseLossResolution, false, 0)).toBe(0);
  });

  it('uses the approved tier and snapshotted-speed clear-repeat intervals', () => {
    expect(BALANCE.scoreTypewriter.clearRepeatFactors).toEqual([0, 2, 1.75, 1.5, 1.25, 1, 1]);
    expect([1, 2, 3, 4, 5, 6].map((tier) =>
      scoreTypewriterClearRepeatMs(tier as ScoreTypewriterTier, 1),
    )).toEqual([920, 805, 690, 575, 460, 460]);
    expect([1, 2, 3, 4, 5, 6].map((tier) =>
      scoreTypewriterClearRepeatMs(tier as ScoreTypewriterTier, 2),
    )).toEqual([460, 402.5, 345, 287.5, 230, 230]);
  });

  it('starts clear cycle zero immediately, self-schedules, and cleans up exactly', () => {
    vi.useFakeTimers();
    try {
      const cycles: number[] = [];
      const stop = scheduleScoreTypewriterClearRepeats(460, (cycle) => cycles.push(cycle));
      expect(cycles).toEqual([0]);
      vi.advanceTimersByTime(920);
      expect(cycles).toEqual([0, 1, 2]);
      stop();
      vi.advanceTimersByTime(920);
      expect(cycles).toEqual([0, 1, 2]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes Enter the deterministic primary for every synthetic clear cycle', () => {
    const ids = [0, 1, 2].map((cycle) => `clear:1-0:7:${cycle}`);
    const sequences = ids.map((id) => scoreTypewriterKeySequence(id, 8, 'Enter'));
    for (const sequence of sequences) {
      expect(SCORE_TYPEWRITER_KEYCAPS[sequence[0]!]!.id).toBe('Enter');
      expect(new Set(sequence).size).toBe(8);
    }
    expect(scoreTypewriterKeySequence(ids[1]!, 8, 'Enter')).toEqual(sequences[1]);
    expect(sequences[0]).not.toEqual(sequences[1]);
  });

  it('rejects invalid submission scores and targets', () => {
    expect(scoreTypewriterTier(Number.NaN, 60)).toBe(0);
    expect(scoreTypewriterTier(Number.POSITIVE_INFINITY, 60)).toBe(0);
    expect(scoreTypewriterTier(60, Number.POSITIVE_INFINITY)).toBe(0);
    expect(scoreTypewriterTier(60, 0)).toBe(0);
    expect(scoreTypewriterTier(60, -1)).toBe(0);
    expect(scoreTypewriterEventDelta(1, 1, 0, Number.NaN, 1, 0)).toBe(0);
  });

  it('classifies target crossing separately from the event tier', () => {
    expect(crossedScoreTarget(99, 100, 100)).toBe(true);
    expect(crossedScoreTarget(100, 120, 100)).toBe(false);
    expect(crossedScoreTarget(99, 99.9, 100)).toBe(false);
    expect(scoreTypewriterTier(60, 60)).toBe(1);
  });

  it('holds the pre-word total until settle activation and completion', () => {
    expect(scoreTypewriterLiveTotal(false, false, 90, 0, 0, 0, 140)).toBe(90);
    expect(scoreTypewriterLiveTotal(false, true, 90, 10, 2, 3, 140)).toBe(113);
    expect(scoreTypewriterLiveTotal(true, false, 90, 0, 0, 0, 140)).toBe(140);
  });

  it('authors one 101-key vintage registry and chooses a semantic-first permutation', () => {
    expect(SCORE_TYPEWRITER_KEYCAPS).toHaveLength(101);
    expect(new Set(SCORE_TYPEWRITER_KEYCAPS.map(({ id }) => id)).size).toBe(101);
    expect(SCORE_TYPEWRITER_KEYCAPS.filter(({ role }) => role === 'main')).toHaveLength(58);
    expect(SCORE_TYPEWRITER_KEYCAPS.filter(({ role }) => role === 'function')).toHaveLength(13);
    expect(SCORE_TYPEWRITER_KEYCAPS.filter(({ role }) => role === 'nav')).toHaveLength(13);
    expect(SCORE_TYPEWRITER_KEYCAPS.filter(({ role }) => role === 'numpad')).toHaveLength(17);
    expect(SCORE_TYPEWRITER_KEYCAPS.some(({ id }) => id.includes('Meta') || id.includes('Windows'))).toBe(false);
    const letterKeys = SCORE_TYPEWRITER_KEYCAPS.filter(({ id }) => /^Key[A-Z]$/.test(id));
    expect(letterKeys).toHaveLength(26);
    expect(letterKeys.map(({ label }) => label).sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row) =>
      row.split('').map((letter) =>
        SCORE_TYPEWRITER_KEYCAPS.find(({ id }) => id === `Key${letter}`)?.label,
      ).join(''),
    )).toEqual(['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']);
    for (const cap of SCORE_TYPEWRITER_KEYCAPS) {
      expect(Object.keys(cap).sort()).toEqual(['h', 'id', 'label', 'role', 'w', 'x', 'y']);
      expect(Number.isFinite(cap.x) && cap.x >= 0 && cap.x <= 100).toBe(true);
      expect(Number.isFinite(cap.y) && cap.y >= 0 && cap.y <= 100).toBe(true);
      expect(cap.x + cap.w).toBeLessThanOrEqual(100);
      expect(cap.y + cap.h).toBeLessThanOrEqual(100);
    }
    const byId = new Map(SCORE_TYPEWRITER_KEYCAPS.map((key) => [key.id, key]));
    expect(byId.get('Space')!.label).toBe('SPACE');
    expect(byId.get('Enter')!.label).toBe('ENTER');
    expect(byId.get('Backspace')!.w / byId.get('Digit1')!.w).toBeCloseTo(2);
    expect(byId.get('Tab')!.w / byId.get('KeyQ')!.w).toBeCloseTo(1.5);
    expect(byId.get('CapsLock')!.w / byId.get('KeyA')!.w).toBeCloseTo(1.75);
    expect(byId.get('Enter')!.w / byId.get('KeyA')!.w).toBeCloseTo(2.25);
    expect(byId.get('ShiftLeft')!.w / byId.get('KeyZ')!.w).toBeCloseTo(2.25);
    expect(byId.get('ShiftRight')!.w / byId.get('KeyZ')!.w).toBeCloseTo(2.75);
    expect(byId.get('Space')!.w / byId.get('KeyA')!.w).toBeCloseTo(7);
    expect(byId.get('ControlLeft')!.w / byId.get('KeyA')!.w).toBeCloseTo(1.25);
    expect(byId.get('AltLeft')!.w / byId.get('KeyA')!.w).toBeCloseTo(1.25);
    expect(byId.get('Space')!.w / byId.get('ControlLeft')!.w).toBeCloseTo(5.6);
    expect(byId.get('Numpad0')!.w).toBeGreaterThan(byId.get('Numpad1')!.w * 1.9);
    expect(byId.get('NumpadAdd')!.h).toBeGreaterThan(byId.get('Numpad7')!.h * 1.9);
    expect(byId.get('NumpadEnter')!.h).toBeGreaterThan(byId.get('Numpad1')!.h * 1.9);
    expect(byId.get('NumLock')!.y).toBeCloseTo(byId.get('Digit1')!.y);
    expect(byId.get('Numpad7')!.y).toBeCloseTo(byId.get('KeyQ')!.y);
    expect(byId.get('Numpad4')!.y).toBeCloseTo(byId.get('KeyA')!.y);
    expect(byId.get('Numpad1')!.y).toBeCloseTo(byId.get('KeyZ')!.y);
    expect(byId.get('Numpad0')!.y).toBeCloseTo(byId.get('Space')!.y);
    for (let left = 0; left < SCORE_TYPEWRITER_KEYCAPS.length; left += 1) {
      const a = SCORE_TYPEWRITER_KEYCAPS[left]!;
      for (let right = left + 1; right < SCORE_TYPEWRITER_KEYCAPS.length; right += 1) {
        const b = SCORE_TYPEWRITER_KEYCAPS[right]!;
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
          .toBe(false);
      }
    }
    expect(BALANCE.scoreTypewriter.visualKeyCounts).toEqual([0, 3, 5, 8, 12, 16, 20]);
    expect(BALANCE.scoreTypewriter.audibleKeyCounts).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const sequence = scoreTypewriterKeySequence('settle-42', 16);
    expect(scoreTypewriterKeySequence('settle-42', 16)).toEqual(sequence);
    expect(new Set(sequence).size).toBe(16);
    expect(sequence.every((index) => index >= 0 && index < 101)).toBe(true);
    expect(scoreTypewriterKeySequence('settle-42', 999)).toHaveLength(101);
    const fullSequence = scoreTypewriterKeySequence('settle-42', 101);
    expect(new Set(fullSequence.slice(1).map((value, index) =>
      (value - fullSequence[index]! + 101) % 101,
    )).size).toBeGreaterThan(1);
    expect(scoreTypewriterKeySequence('ab', 101)).not.toEqual(
      scoreTypewriterKeySequence('ba', 101),
    );
    const semantic = scoreTypewriterKeySequence('semantic', 8, 'Enter');
    expect(SCORE_TYPEWRITER_KEYCAPS[semantic[0]!]!.id).toBe('Enter');
    expect(new Set(semantic).size).toBe(8);
  });

  it('maps score-event semantics to their primary keys without engine state', () => {
    const tiles = [{ id: 'a', letter: 'A' }, { id: 'stone', letter: null }] as const;
    expect(scoreTypewriterPrimaryKey({ kind: 'tile', tileId: 'a', letter: 'A', chips: 1 }, tiles)).toBe('KeyA');
    expect(scoreTypewriterPrimaryKey({ kind: 'tile', tileId: 'stone', letter: null, chips: 1 }, tiles)).toBe('Space');
    expect(scoreTypewriterPrimaryKey({ kind: 'material', material: 'brass', tileId: 'a', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('KeyA');
    expect(scoreTypewriterPrimaryKey({ kind: 'material', material: 'stone', tileId: 'stone', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('Space');
    expect(scoreTypewriterPrimaryKey({ kind: 'suit', suit: 'formal', mult: 2 }, tiles)).toBe('Enter');
    expect(scoreTypewriterPrimaryKey({ kind: 'letterHand', hand: 'palindrome', level: 1, chipsDelta: 1, multDelta: 0, multFactor: 1 }, tiles)).toBe('Enter');
    expect(scoreTypewriterPrimaryKey({ kind: 'tag', tagId: 'economyTag', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('Tab');
    expect(scoreTypewriterPrimaryKey({ kind: 'tag', tagId: 'scarletTag', tileId: 'a', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('KeyA');
    expect(scoreTypewriterPrimaryKey({ kind: 'tag', tagId: 'scarletTag', tileId: 'stone', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('Space');
    expect(scoreTypewriterPrimaryKey({ kind: 'boss', bossId: 'wanted', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('Break');
    expect(scoreTypewriterPrimaryKey({ kind: 'pouch', pouchId: 'yellow', chipsDelta: 1, multDelta: 0 }, tiles)).toBe('Space');
    expect(scoreTypewriterPrimaryKey({ kind: 'joker', jokerId: 'test', chipsDelta: 1, multDelta: 0 }, tiles)).toMatch(/^F(?:[1-9]|1[0-2])$/);
  });

  it('uses deterministic uneven gaps and finishes every key inside its score beat', () => {
    const tiers: ScoreTypewriterTier[] = [1, 2, 3, 4, 5, 6];
    for (const speed of [1, 2]) {
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
    const tierSix = Array.from(
      { length: BALANCE.scoreTypewriter.visualKeyCounts[6] },
      (_, index) => scoreTypewriterKeyTiming(
        'settle-42',
        1,
        6,
        index,
        BALANCE.scoreTypewriter.visualKeyCounts[6],
      ),
    );
    const gaps = tierSix.slice(1).map((timing, index) =>
      Number((timing.delayMs - tierSix[index]!.delayMs).toFixed(6)),
    );
    expect(new Set(gaps).size).toBeGreaterThan(1);
    expect(BALANCE.scoreTypewriter.keyRhythmJitter).toBe(0.35);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThanOrEqual(
      (1 + BALANCE.scoreTypewriter.keyRhythmJitter) /
      (1 - BALANCE.scoreTypewriter.keyRhythmJitter),
    );
    expect(BALANCE.scoreTypewriter.keyPressMs).toEqual([0, 96, 88, 76, 64, 56, 48]);
  });

  it('normalizes screen shake and scales it monotonically by event tier', () => {
    expect(scoreTypewriterShake(0, 5)).toBe(0);
    expect(scoreTypewriterShake(50, 5)).toBe(0.5);
    expect(scoreTypewriterShake(100, 0)).toBe(0);
    expect(scoreTypewriterShake(100, 1)).toBe(0.1);
    expect(scoreTypewriterShake(100, 2)).toBe(0.2);
    expect(scoreTypewriterShake(100, 3)).toBe(0.45);
    expect(scoreTypewriterShake(100, 4)).toBe(0.7);
    expect(scoreTypewriterShake(100, 5)).toBe(1);
    expect(scoreTypewriterShake(100, 6)).toBe(1);
    expect(scoreTypewriterShake(200, 6)).toBe(1);
  });
});
