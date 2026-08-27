import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { discardTiles, startBlind } from '../src/engine/loop';
import { nextLockLetter } from '../src/ui/game';
import {
  claimTutorialInitialization,
  isTutorialTilePrefix,
  tutorialDeal,
} from '../src/ui/tutorial';
import type { Letter } from '../src/engine/types';
import { scoreWord } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { blindTarget } from '../src/engine/economy';

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

  it('spends one real discard on the first spare while preserving the six YELLOW tiles', () => {
    const run = newRun('lesson-discard');
    const before = startBlind(run, makeRng('lesson-discard#0'), { openingLetters: YELLOW });
    const deal = tutorialDeal(before)!;
    const target = deal.discardTargetId!;
    const after = discardTiles(before, run, [target], makeRng('lesson-discard#1')).blind;

    expect(before.hand.length).toBeGreaterThan(YELLOW.length);
    expect(after.hand).toHaveLength(before.hand.length);
    expect(after.hand.slice(0, YELLOW.length).map((tile) => tile.id)).toEqual(deal.wordTileIds);
    expect(after.discardsLeft).toBe(before.discardsLeft - 1);
    expect(after.discardedThisBlind.map((tile) => tile.id)).toContain(target);
    expect(after.phasesUsed).toBe(before.phasesUsed);
    expect(after.committedScore).toBe(before.committedScore);
    expect(tutorialDeal(after)).toEqual({ ...deal, discardDone: true });
  });

  it('uses the seeded bag deterministically and tolerates a missing spare', () => {
    const run = newRun('lesson-repeat');
    const play = () => {
      const before = startBlind(run, makeRng('lesson-repeat#0'), { openingLetters: YELLOW });
      const target = tutorialDeal(before)!.discardTargetId!;
      return discardTiles(before, run, [target], makeRng('lesson-repeat#1')).blind;
    };
    expect(play().hand.map((tile) => tile.id)).toEqual(play().hand.map((tile) => tile.id));

    const short = startBlind(run, makeRng('lesson-short#0'), { openingLetters: YELLOW });
    expect(tutorialDeal({ ...short, hand: short.hand.slice(0, YELLOW.length) })?.discardTargetId)
      .toBeNull();
  });

  it('accepts only an exact physical-ID prefix when resuming the guided build', () => {
    const run = newRun('lesson-prefix');
    const blind = startBlind(run, makeRng('lesson-prefix#0'), { openingLetters: YELLOW });
    const ids = tutorialDeal(blind)!.wordTileIds;
    expect(isTutorialTilePrefix([], ids)).toBe(true);
    expect(isTutorialTilePrefix(ids.slice(0, 3), ids)).toBe(true);
    expect(isTutorialTilePrefix(ids, ids)).toBe(true);
    expect(isTutorialTilePrefix([ids[0]!, ids[2]!], ids)).toBe(false);
    expect(isTutorialTilePrefix([blind.hand[6]!.id], ids)).toBe(false);
    expect(isTutorialTilePrefix([blind.hand[6]!.id, ...ids.slice(1)], ids)).toBe(false);
  });

  it('claims legacy-selection cleanup only once per blind under a replayed effect', () => {
    const claimed = new Set<string>();
    const key = 'lesson-seed:1:0';
    let toggles = 0;
    if (claimTutorialInitialization(claimed, key)) toggles += 6;
    if (claimTutorialInitialization(claimed, key)) toggles += 6;
    expect(toggles).toBe(6);
    expect(claimTutorialInitialization(claimed, 'lesson-seed:1:1')).toBe(true);
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

describe('the guided intro survives the target curve (GDD §13, 2026-07-30)', () => {
  it('a single YELLOW cannot clear the ante-1 small blind', () => {
    // The intro rigs the opening hand to Y-E-L-L-O-W and relies on that word
    // ENDING THE LESSON without clearing the blind. YELLOW = 36 chips, standard
    // ×1.0, length 6 => 36 × 7.0 = 252, so ante-1 small must stay above it.
    const lex = makeLexicon(['yellow'], {});
    let idc = 0;
    const tiles = [...'YELLOW'].map((ch) => ({
      id: `y${idc++}`,
      letter: ch as Letter,
      material: 'ceramic' as const,
      font: 'medium' as const,
    }));
    const score = scoreWord(tiles, lex).settledScore;
    expect(score).toBe(252);
    expect(score).toBeLessThan(blindTarget(1, 'small'));
  });
});
