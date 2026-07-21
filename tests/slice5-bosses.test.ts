import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord } from '../src/engine/loop';
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
  return submitWord({ ...blind, hand }, run, lex, hand.map((t) => t.id), makeRng('test'));
};

describe('slice5 bosses — setup / structural effects (GDD §8.3)', () => {
  it('Wanted (수배 전단): target ×2', () => {
    const r = bossRun();
    const plain = startBlind(r, makeRng('w'), { kind: 'boss', bossId: 'contract' }).target;
    const wanted = startBlind(r, makeRng('w'), { kind: 'boss', bossId: 'wanted' }).target;
    expect(wanted).toBe(plain * 2);
  });
  it('History Book (역사책): phases 4 → 2', () => {
    expect(bossBlind(bossRun(), 'historyBook').phasesTotal).toBe(2);
  });
  it('Contract (계약서): start with 0 discards', () => {
    expect(bossBlind(bossRun(), 'contract').discardsLeft).toBe(0);
  });
  it('Budget Book (가계부): opening hand −3', () => {
    const r = bossRun();
    expect(bossBlind(r, 'budgetBook').hand.length).toBe(r.handSize - 3);
  });
  it('Ancient Paper (고대 문서): vowels-hidden flag set', () => {
    expect(bossBlind(bossRun(), 'ancientPaper').vowelsHidden).toBe(true);
  });
  it('a boss blind with no explicit id draws a valid boss', () => {
    const b = startBlind(bossRun(), makeRng('x'), { kind: 'boss' });
    expect(CORE_BOSS_IDS).toContain(b.bossId);
  });
});

describe('slice5 bosses — scoring effects', () => {
  it('White Paper (백지): vulgar words score 0', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'whitePaper'), r, 'damn').submission.settledScore).toBe(0);
  });
  it('Burnt Paper (그을린 종이): verb words score 0; nouns score normally', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'burntPaper'), r, 'run').submission.settledScore).toBe(0);
    expect(play(bossBlind(r, 'burntPaper'), r, 'cat').submission.settledScore).toBeGreaterThan(0);
  });
  it('Will (유서): base chips & mult halved (CAT 5×1 → 2.5×0.5 = 1.25)', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'will'), r, 'cat').submission.settledScore).toBe(1.25);
  });
  it('Memoirs (회고록): a word already played this ante scores 0; a fresh one scores', () => {
    const r = { ...bossRun(), wordsThisAnte: ['cat'] };
    expect(play(bossBlind(r, 'memoirs'), r, 'cat').submission.settledScore).toBe(0);
    expect(play(bossBlind(r, 'memoirs'), r, 'run').submission.settledScore).toBeGreaterThan(0);
  });
});

describe('slice5 bosses — void, economy, hand churn', () => {
  it('Forbidden Paper (금서): once a suit is established, other suits void to 0; gibberish is exempt', () => {
    const r = bossRun();
    let b = bossBlind(r, 'forbiddenPaper');
    const first = play(b, r, 'cat'); // standard establishes the lock
    ({ blind: b } = first);
    expect(first.submission.settledScore).toBeGreaterThan(0);
    const second = play(b, r, 'damn'); // vulgar ≠ standard → void
    expect(second.submission.settledScore).toBe(0);
  });

  it('Bond (채권): each submission drains $1 per tile played (CAT → −3)', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'bond'), r, 'cat').goldDelta).toBe(-3);
  });

  it('Unopened Letter (미개봉 편지): each play dumps up to 4 extra random hand tiles, refilled', () => {
    const r = bossRun();
    const b = startBlind(r, makeRng('letter'), { kind: 'boss', bossId: 'letter', target: 100_000 });
    const ids = b.hand.slice(0, 3).map((t) => t.id);
    const res = submitWord(b, r, lex, ids, makeRng('t'));
    // 3 played + 4 dumped by Letter = 7 tiles have left play this blind
    expect(res.blind.discardedThisBlind.length).toBe(7);
    // dumped tiles are replaced, so hand size is preserved
    expect(res.blind.hand.length).toBe(b.hand.length);
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
