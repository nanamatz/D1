import { describe, expect, it } from 'vitest';
import {
  addLetterHandStamps,
  awardBlindLetterHandStamps,
  letterHandStampCost,
} from '../src/engine/letterHands';
import { startBlind } from '../src/engine/loop';
import { resolveBlind } from '../src/engine/progression';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { BlindState, WordSubmission } from '../src/engine/types';

const firstRng: Pick<Rng, 'int'> = { int: () => 0 };

const submission = (text: string): WordSubmission => ({
  tiles: [],
  text,
  isGibberish: false,
  suit: 'standard',
  posUsed: null,
  settledScore: 0,
  scoringLength: text.length,
});

const blindWith = (run: ReturnType<typeof newRun>, words: string[]): BlindState => ({
  ...startBlind(run, makeRng('word-hand-level-blind')),
  target: 0,
  sequence: words.map(submission),
});

describe('Word Hand stamp progression', () => {
  it('uses 1 stamp through level 5, 3 through level 8, then 5', () => {
    expect(letterHandStampCost(1)).toBe(1);
    expect(letterHandStampCost(5)).toBe(1);
    expect(letterHandStampCost(6)).toBe(3);
    expect(letterHandStampCost(8)).toBe(3);
    expect(letterHandStampCost(9)).toBe(5);

    const run = newRun('stamp-steps');
    const early = addLetterHandStamps(run, 'twin', 5).run;
    expect(early.letterHandLevels?.twin).toBe(6);
    expect(early.letterHandStamps?.twin).toBe(0);
    const middle = addLetterHandStamps(early, 'twin', 3).run;
    expect(middle.letterHandLevels?.twin).toBe(7);
    const lateRun = {
      ...middle,
      letterHandLevels: { ...middle.letterHandLevels, twin: 9 },
      letterHandStamps: { ...middle.letterHandStamps, twin: 0 },
    };
    const late = addLetterHandStamps(lateRun, 'twin', 5).run;
    expect(late.letterHandLevels?.twin).toBe(10);
  });

  it('awards the highest play count and resolves ties to the latest tied hand', () => {
    const run = newRun('stamp-most-played');
    const blind = blindWith(run, ['BOOK', 'PLANET', 'BOOK', 'PLANET']);
    const result = awardBlindLetterHandStamps(run, blind, firstRng);
    expect(result.reward).toMatchObject({ hand: 'longword', stamps: 2, random: false });
    expect(result.run.letterHandLevels?.longword).toBe(3);
  });

  it('awards one seeded-random stamp when the blind scored no Word Hand', () => {
    const run = newRun('stamp-random');
    const result = awardBlindLetterHandStamps(run, blindWith(run, ['CAT']), firstRng);
    expect(result.reward).toMatchObject({ hand: 'twin', stamps: 1, random: true });
    expect(result.run.letterHandLevels?.twin).toBe(2);
  });

  it('limits a random stamp to discovered hands and skips it when none are eligible', () => {
    const run = newRun('stamp-discovery-pool');
    const blind = blindWith(run, ['CAT']);
    const eligible = awardBlindLetterHandStamps(run, blind, firstRng, ['vowelless']);
    expect(eligible.reward).toMatchObject({ hand: 'vowelless', random: true });

    const none = awardBlindLetterHandStamps(run, blind, firstRng, []);
    expect(none.reward).toBeNull();
    expect(none.run).toBe(run);
  });

  it('awards stamps only after a successful clear', () => {
    const run = newRun('stamp-clear-only');
    const blind = { ...blindWith(run, ['BOOK']), target: 100 };
    const loss = resolveBlind(run, blind, 99);
    expect(loss.earned.letterHandReward).toBeNull();
    expect(loss.run.letterHandLevels?.twin).toBe(1);

    const clear = resolveBlind(run, blind, 100);
    expect(clear.earned.letterHandReward).toMatchObject({ hand: 'twin', stamps: 1 });
    expect(clear.run.letterHandLevels?.twin).toBe(2);
  });
});
