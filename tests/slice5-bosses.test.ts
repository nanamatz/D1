import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord, canEndEarly } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import { drawBoss, CORE_BOSS_IDS } from '../src/engine/bosses';
import type { BlindState, Letter, RunState, Tile } from '../src/engine/types';

const lex = makeLexicon(['bright'], {
  cat: { suit: 'standard', pos: ['noun'] },
  damn: { suit: 'vulgar', pos: ['interjection'] },
  run: { suit: 'standard', pos: ['verbIntransitive'] },
});

let idc = 0;
const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `b${idc++}`,
    letter: c as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

const bossRun = () => newRun('boss'); // no jokers → isolates boss effects
const bossBlind = (run: RunState, bossId: string, target = 100_000): BlindState =>
  startBlind(run, makeRng('boss'), { kind: 'boss', bossId, target });
const play = (blind: BlindState, run: RunState, word: string) => {
  const hand = tilesFor(word);
  return submitWord({ ...blind, hand }, run, lex, hand.map((t) => t.id));
};

describe('slice5 bosses — setup effects (GDD §8.3)', () => {
  it('Guillotine: phases 4 → 2', () => {
    expect(bossBlind(bossRun(), 'guillotine').phasesTotal).toBe(2);
  });
  it('Hoarder: discards disabled', () => {
    expect(bossBlind(bossRun(), 'hoarder').discardsLeft).toBe(0);
  });
  it('Perfectionist: early end disabled even at/above target', () => {
    const b = { ...bossBlind(bossRun(), 'perfectionist', 10), projectedScore: 999 };
    expect(canEndEarly(b)).toBe(false);
  });
  it('Blindfold: preview hidden flag set', () => {
    expect(bossBlind(bossRun(), 'blindfold').previewHidden).toBe(true);
  });
  it('a boss blind with no explicit id draws a valid boss', () => {
    const b = startBlind(bossRun(), makeRng('x'), { kind: 'boss' });
    expect(CORE_BOSS_IDS).toContain(b.bossId);
  });
});

describe('slice5 bosses — scoring effects', () => {
  it('Censor: vulgar words score 0', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'censor'), r, 'damn').submission.settledScore).toBe(0);
  });
  it('Snob: standard multiplier halved (CAT 5 → 2.5)', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'snob'), r, 'cat').submission.settledScore).toBe(2.5);
  });
  it('Editor: words of 4 letters or fewer score 0; 5+ score normally', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'editor'), r, 'cat').submission.settledScore).toBe(0);
    expect(play(bossBlind(r, 'editor'), r, 'bright').submission.settledScore).toBe(12); // B3R1I1G2H4T1
  });
  it('Mute: vowel tiles contribute 0 chips (CAT 5 → 4)', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'mute'), r, 'cat').submission.settledScore).toBe(4); // 5 − A(1)
  });
  it('Anarchist: sentence bonus does not trigger (projected == committed)', () => {
    const r = bossRun();
    const { blind } = play(bossBlind(r, 'anarchist'), r, 'run'); // RUN would be Imperative
    expect(blind.projectedScore).toBe(blind.committedScore);
  });
});

describe('slice5 bosses — legality, void, economy', () => {
  it('Noun Lock: verb words cannot be submitted; nouns can', () => {
    const r = bossRun();
    expect(() => play(bossBlind(r, 'nounLock'), r, 'run')).toThrow(/boss/i);
    expect(() => play(bossBlind(r, 'nounLock'), r, 'cat')).not.toThrow();
  });

  it('Purist: once 2 distinct suits are played, subsequent words void to 0', () => {
    const r = bossRun();
    let b = bossBlind(r, 'purist');
    ({ blind: b } = play(b, r, 'cat')); // standard
    ({ blind: b } = play(b, r, 'damn')); // vulgar → now 2 suits
    const third = play(b, r, 'cat');
    expect(third.submission.settledScore).toBe(0);
  });

  it('Taxman: each submission carries a −1 gold delta', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'taxman'), r, 'cat').goldDelta).toBe(-1);
  });

  it('no boss → no gold delta', () => {
    const r = newRun('plain');
    const blind = startBlind(r, makeRng('plain'));
    expect(play(blind, r, 'cat').goldDelta).toBe(0);
  });

  it('drawBoss is deterministic per rng', () => {
    expect(drawBoss(makeRng('z'))).toBe(drawBoss(makeRng('z')));
  });
});
