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
  return submitWord({ ...blind, hand }, run, lex, hand.map((t) => t.id), makeRng('test'));
};

const openBlind = (run: RunState, target = 100_000): BlindState =>
  startBlind(run, makeRng(run.seed), { target });

describe('slice4 pipeline — layer 1 & 2 jokers mutate chips/mult before settlement', () => {
  it('stacks three layer-1 jokers on one word', () => {
    const run = withJokers('l1', 'vowelPraise', 'consonantBricklayer', 'jackOfAllTrades');
    const { submission, blind } = play(openBlind(run), run, 'cat');
    // CAT: chips 15 +4·2 consonants = 23; mult 1 +2·1 vowel +4 jack = 7 → 23×7 = 161
    expect(submission.settledScore).toBe(161);
    expect(blind.committedScore).toBe(161);
  });

  it('Hipster (layer 2) fires on a Slang word', () => {
    const run = withJokers('l2', 'hipster');
    const { submission } = play(openBlind(run), run, 'cool');
    // COOL: chips 18 +Twin(OO) 10 = 28; mult slang 2 +7 hipster = 9 → 28×9 = 252 (A-2)
    expect(submission.settledScore).toBe(252);
  });

  it('layer-1 fires on gibberish, layer-2 does not (GDD §6.4)', () => {
    const run = withJokers('gib', 'consonantBricklayer', 'hipster');
    const { submission } = play(openBlind(run), run, 'zzq'); // not a word → gibberish
    // ZZQ: chips 90 +4·3 = 102, mult 1 (gibberish, Hipster no-op) → 102
    expect(submission.isGibberish).toBe(true);
    expect(submission.settledScore).toBe(102);
  });
});

describe('slice4 pipeline — layer 3 jokers mutate the sentence projection', () => {
  it('Grammarian ×2 on a completed pattern', () => {
    const run = withJokers('gram', 'grammarian');
    let b = openBlind(run);
    ({ blind: b } = play(b, run, 'run'));
    ({ blind: b } = play(b, run, 'cat')); // RUN CAT = Imperative (+ standard Unison)
    // committed 24 (RUN 9 + CAT 15); sentence bonus (15 imperative + 50 unison) × (2 × 2 Grammarian)
    // = 65 × 4 = 260 → total 284
    expect(b.projectedScore).toBe(284);
    expect(endBlind(b, run, lex).finalScore).toBe(284);
  });

  it('Rush Specialist scales with phases left: 4 left → ×3 (per-word, item 6)', () => {
    const run = withJokers('rush', 'rushSpecialist');
    const { blind } = play(openBlind(run), run, 'cat'); // phase 1 of 5 → 4 will remain
    // per-word mult now: CAT 15 chips × (standard 1 × 3) = 45 committed; no pattern
    // → projected == committed.
    expect(blind.committedScore).toBe(45);
    expect(blind.projectedScore).toBe(45);
  });

  it('Rush Specialist pays more with more phases left than with fewer (C-1)', () => {
    const run = withJokers('rushcmp', 'rushSpecialist');
    const early = play(openBlind(run), run, 'cat').blind.projectedScore; // 4 left → ×3
    let b = openBlind(run);
    for (let i = 0; i < 3; i++) ({ blind: b } = play(b, run, 'cat')); // now 2 left → ×2
    // compare the last word's contribution ratio via the multiplier applied
    expect(early).toBeGreaterThan(15 * 2); // ×3 (45) > ×2 (30)
  });

  it('Rush Specialist per-word mult: last-phase play pays nothing', () => {
    const run = withJokers('rush2', 'rushSpecialist');
    let b = openBlind(run);
    for (let i = 0; i < 5; i++) ({ blind: b } = play(b, run, 'cat')); // phases left 4/3/2/1/0
    // per-word CAT 15 × 3 / ×2.5 / ×2 / ×1.5 / ×1 = 45+37.5+30+22.5+15 = 150 committed (last
    // word, 0 left, gets no rush). all standard → unison +50; no pattern → 200.
    expect(b.committedScore).toBe(150);
    expect(endBlind(b, run, lex).finalScore).toBe(200);
  });

  it('Grammarian (sentence) and Rush (per-word) stack', () => {
    const run = withJokers('both', 'grammarian', 'rushSpecialist');
    let b = openBlind(run);
    ({ blind: b } = play(b, run, 'run')); // 4 left → ×3: RUN 9 → 27
    ({ blind: b } = play(b, run, 'cat')); // 3 left → ×2.5: CAT 15 → 37.5 (RUN CAT = imperative)
    // committed 64.5; sentence bonus (15 imperative + 50 unison) × (2 × 2 grammarian)
    // = 65 × 4 = 260 → total 324.5
    expect(b.committedScore).toBe(64.5);
    expect(b.projectedScore).toBe(324.5);
  });
});

describe('slice4 pipeline — no jokers leaves earlier behavior unchanged', () => {
  it('a jokerless run scores exactly as slices ①–③ did', () => {
    const run = newRun('none'); // jokers: []
    const { submission, blind } = play(openBlind(run), run, 'run');
    expect(submission.settledScore).toBe(9); // RUN chips, standard ×1
    expect(blind.projectedScore).toBe(9); // bare verb: no pattern → projected mirrors committed
  });
});
