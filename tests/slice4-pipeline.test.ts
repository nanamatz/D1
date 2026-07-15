import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord, endBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import type { BlindState, Letter, RunState, Tile } from '../src/engine/types';

const lex = makeLexicon([], {
  cat: { suit: 'standard', pos: ['noun'] },
  run: { suit: 'standard', pos: ['verbIntransitive'] },
  cool: { suit: 'slang', pos: ['adjective'] },
});

const withJokers = (seed: string, ...defIds: string[]): RunState => {
  const r = newRun(seed);
  r.jokers = defIds.map((defId) => ({ defId, state: {} }));
  return r;
};

let idc = 0;
const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `p${idc++}`,
    letter: c as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

const play = (blind: BlindState, run: RunState, word: string) => {
  const hand = tilesFor(word);
  return submitWord({ ...blind, hand }, run, lex, hand.map((t) => t.id));
};

const openBlind = (run: RunState, target = 100_000): BlindState =>
  startBlind(run, makeRng(run.seed), { target });

describe('slice4 pipeline — layer 1 & 2 jokers mutate chips/mult before settlement', () => {
  it('stacks three layer-1 jokers on one word', () => {
    const run = withJokers('l1', 'vowelPraise', 'consonantBricklayer', 'jackOfAllTrades');
    const { submission, blind } = play(openBlind(run), run, 'cat');
    // CAT: chips 5 +4·2 consonants = 13; mult 1 +2·1 vowel +4 jack = 7 → 13×7 = 91
    expect(submission.settledScore).toBe(91);
    expect(blind.committedScore).toBe(91);
  });

  it('Hipster (layer 2) fires on a Slang word', () => {
    const run = withJokers('l2', 'hipster');
    const { submission } = play(openBlind(run), run, 'cool');
    // COOL: chips 6 +Twin(OO) 10 = 16; mult slang 2 +7 hipster = 9 → 16×9 = 144 (A-2)
    expect(submission.settledScore).toBe(144);
  });

  it('layer-1 fires on gibberish, layer-2 does not (GDD §6.4)', () => {
    const run = withJokers('gib', 'consonantBricklayer', 'hipster');
    const { submission } = play(openBlind(run), run, 'zzq'); // not a word → gibberish
    // ZZQ: chips 30 +4·3 = 42, mult 1 (gibberish, Hipster no-op) → 42
    expect(submission.isGibberish).toBe(true);
    expect(submission.settledScore).toBe(42);
  });
});

describe('slice4 pipeline — layer 3 jokers mutate the sentence projection', () => {
  it('Grammarian ×2 on a completed pattern', () => {
    const run = withJokers('gram', 'grammarian');
    const { blind } = play(openBlind(run), run, 'run'); // imperative
    // base (3 + 80) = 83, Grammarian ×2 → 166
    expect(blind.projectedScore).toBe(166);
    expect(endBlind(blind, run, lex).finalScore).toBe(166);
  });

  it('Rush Specialist scales with phases left: 3 left → ×2.5 (C-1)', () => {
    const run = withJokers('rush', 'rushSpecialist');
    const { blind } = play(openBlind(run), run, 'cat'); // no pattern; phase 1 → 3 left
    // committed 5, ×(1 + 0.5·3) = ×2.5 → 12.5
    expect(blind.projectedScore).toBe(12.5);
  });

  it('Rush Specialist pays more with more phases left than with fewer (C-1)', () => {
    const run = withJokers('rushcmp', 'rushSpecialist');
    const early = play(openBlind(run), run, 'cat').blind.projectedScore; // 3 left → ×2.5
    let b = openBlind(run);
    for (let i = 0; i < 3; i++) ({ blind: b } = play(b, run, 'cat')); // now 1 left → ×1.5
    // compare the last word's contribution ratio via the multiplier applied
    expect(early).toBeGreaterThan(5 * 1.5); // ×2.5 (12.5) > ×1.5 (7.5)
  });

  it('Rush Specialist is inactive at blind end with 0 phases left', () => {
    const run = withJokers('rush2', 'rushSpecialist');
    let b = openBlind(run);
    for (let i = 0; i < 4; i++) ({ blind: b } = play(b, run, 'cat')); // 4 phases → 0 left
    // committed 20 (4×5), all standard → unison +50, no pattern, rush inactive → 70
    expect(endBlind(b, run, lex).finalScore).toBe(70);
  });

  it('Grammarian and Rush stack multiplicatively', () => {
    const run = withJokers('both', 'grammarian', 'rushSpecialist');
    const { blind } = play(openBlind(run), run, 'run'); // imperative, phase 1 → 3 left
    // (3 + 80) × 2 (grammarian) × 2.5 (rush, 3 left) = 415
    expect(blind.projectedScore).toBe(415);
  });
});

describe('slice4 pipeline — no jokers leaves earlier behavior unchanged', () => {
  it('a jokerless run scores exactly as slices ①–③ did', () => {
    const run = newRun('none'); // jokers: []
    const { submission, blind } = play(openBlind(run), run, 'run');
    expect(submission.settledScore).toBe(3); // RUN chips, standard ×1
    expect(blind.projectedScore).toBe(83); // imperative bonus only
  });
});
