import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { startBlind } from '../src/engine/loop';
import { nextLockLetter } from '../src/ui/game';
import type { Letter } from '../src/engine/types';

const YELLOW = 'YELLOW'.split('') as Letter[];

describe('first-run lesson — rigged opening hand (startBlind openingLetters)', () => {
  it('front-loads the requested letters in order, then fills to hand size', () => {
    const run = newRun('lesson-seed');
    const blind = startBlind(run, makeRng('lesson-seed#0'), { openingLetters: YELLOW });
    // the first 6 tiles spell YELLOW, in order
    expect(blind.hand.slice(0, 6).map((t) => t.letter)).toEqual(YELLOW);
    // the hand is still the full hand size (no tiles lost)
    expect(blind.hand.length).toBe(run.handSize);
  });

  it('is inert without the option — the hand is a normal shuffled draw', () => {
    const run = newRun('lesson-seed');
    const rigged = startBlind(run, makeRng('same#0'), { openingLetters: YELLOW });
    const plain = startBlind(run, makeRng('same#0'), {});
    // same rng, but the rigged hand leads with YELLOW while the plain one (almost surely) does not
    expect(rigged.hand.slice(0, 6).map((t) => t.letter)).toEqual(YELLOW);
    expect(plain.hand.slice(0, 6).map((t) => t.letter)).not.toEqual(YELLOW);
  });

  it('skips a letter the bag cannot supply (defensive), without throwing', () => {
    const run = newRun('lesson-seed');
    // Z appears twice in the bag; ask for 3 — the third is skipped, no crash.
    const blind = startBlind(run, makeRng('z#0'), { openingLetters: ['Z', 'Z', 'Z'] as Letter[] });
    expect(blind.hand.filter((t) => t.letter === 'Z').length).toBeLessThanOrEqual(2);
    expect(blind.hand.length).toBe(run.handSize);
  });
});

describe('first-run lesson — lock helper (nextLockLetter)', () => {
  it('walks Y→E→L→L→O→W, then null when complete', () => {
    const w = 'YELLOW';
    expect(nextLockLetter([], w)).toBe('Y');
    expect(nextLockLetter(['Y'], w)).toBe('E');
    expect(nextLockLetter(['Y', 'E'], w)).toBe('L');
    expect(nextLockLetter(['Y', 'E', 'L'], w)).toBe('L');
    expect(nextLockLetter(['Y', 'E', 'L', 'L'], w)).toBe('O');
    expect(nextLockLetter(['Y', 'E', 'L', 'L', 'O'], w)).toBe('W');
    expect(nextLockLetter(['Y', 'E', 'L', 'L', 'O', 'W'], w)).toBeNull();
  });

  it('is case-insensitive and tolerates nulls (stone tiles)', () => {
    expect(nextLockLetter([], 'yellow')).toBe('Y');
    expect(nextLockLetter([null], 'YELLOW')).toBe('E'); // length-based, always a prefix under lock
  });
});
