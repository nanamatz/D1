import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { endBlind, startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import { drawBoss, CORE_BOSS_IDS } from '../src/engine/bosses';
import { createOwnedJoker } from '../src/engine/jokers';
import { stagePreview } from '../src/ui/game';
import type { BlindState, Letter, RunState, Tile } from '../src/engine/types';

const lex = makeLexicon(['bright'], {
  cat: { suit: 'standard', pos: ['noun'] },
  damn: { suit: 'vulgar', pos: ['interjection'] },
  run: { suit: 'standard', pos: ['verbIntransitive'] },
  edict: { suit: 'formal', pos: ['noun'] },
  yo: { suit: 'slang', pos: ['interjection'] },
});

let idc = 0;
const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `b${idc++}`,
    letter: c as Letter,
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
  it('History Book (역사책): reduces only this blind by 2 phases', () => {
    expect(bossBlind(bossRun(), 'historyBook').phasesTotal).toBe(3);
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
    const result = play(bossBlind(r, 'whitePaper'), r, 'damn');
    expect(result.submission.settledScore).toBe(0);
    expect(result.submission.debuffed).toBe(true);
    expect(result.events).toEqual([{ kind: 'settle', chips: 0, mult: 0, total: 0 }]);
  });
  it('Burnt Paper (그을린 종이): verb words score 0; nouns score normally', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'burntPaper'), r, 'run').submission.settledScore).toBe(0);
    expect(play(bossBlind(r, 'burntPaper'), r, 'cat').submission.settledScore).toBeGreaterThan(0);
  });
  it('Will (유서): base chips & mult halved (CAT 15 chips × (1.0 + length 3) = 4.0 mult → halved 7.5 × 2.0 = 15)', () => {
    const r = bossRun();
    // CAT = 15 chips; standard ×1.0 + length 3 => mult 4.0 before Will halves both:
    // chips 15 → 7.5, mult 4.0 → 2.0, total 7.5 × 2.0 = 15
    const result = play(bossBlind(r, 'will'), r, 'cat');
    expect(result.submission.settledScore).toBe(15);
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: 'boss',
      bossId: 'will',
      chipsFactor: BALANCE.boss.willScale,
      multFactor: BALANCE.boss.willScale,
    }));
  });
  it('Memoirs (회고록): a word already played this ante scores 0; a fresh one scores', () => {
    const r = { ...bossRun(), wordsThisAnte: ['cat'] };
    expect(play(bossBlind(r, 'memoirs'), r, 'cat').submission.settledScore).toBe(0);
    expect(play(bossBlind(r, 'memoirs'), r, 'run').submission.settledScore).toBeGreaterThan(0);
  });

  it('short-circuits every score effect and score RNG for a debuffed play', () => {
    const r = bossRun();
    r.jokers = ['dullingPencil', 'zombie', 'rotaryPress']
      .map((id) => createOwnedJoker(r, id));
    const hand = tilesFor('damn').map((tile, index) => index === 0
      ? { ...tile, material: 'glass' as const, font: 'black' as const, edition: 'rainbow' as const }
      : tile);
    const started = bossBlind(r, 'whitePaper');
    const blind = {
      ...started,
      hand,
      bag: [],
      phasesUsed: started.phasesTotal - 1,
    };
    const noScoreRng = {
      next: () => { throw new Error('score RNG must not run'); },
      int: () => { throw new Error('score RNG must not run'); },
      shuffle: <T,>(_items: readonly T[]): T[] => { throw new Error('score RNG must not run'); },
    };
    const result = submitWord(blind, r, lex, hand.map((tile) => tile.id), noScoreRng);

    expect(result.events).toEqual([{ kind: 'settle', chips: 0, mult: 0, total: 0 }]);
    expect(result.goldDelta).toBe(0);
    expect(result.destroyedTileIds).toEqual([]);
    expect(result.grownWoodTileIds).toEqual([]);
    expect(result.createdTiles).toEqual([]);
    expect(result.blind.bag).toEqual([]); // Zombie did not return the played tiles.
    expect(result.jokers).toEqual(r.jokers);
    expect(result.counters.totalWords).toBe(r.counters.totalWords);
    expect(result.playedWords).toEqual(r.playedWords);
    expect(result.playedLetterHands).toEqual(r.playedLetterHands);
    expect(result.letterHandPlayCounts).toEqual(r.letterHandPlayCounts);
    expect(result.lastLetterHand).toBe(r.lastLetterHand);
  });

  it('shares Tower of Babel rule preparation between preview and White Paper submit', () => {
    const r = bossRun();
    r.jokers = [createOwnedJoker(r, 'towerOfBabel')];
    const hand = tilesFor('cat');
    const blind = { ...bossBlind(r, 'whitePaper'), hand };
    const before = JSON.stringify(r);
    const preview = stagePreview(blind, r, lex, hand.map((tile) => tile.id));
    const result = submitWord(blind, r, lex, hand.map((tile) => tile.id), makeRng('tower-white'));

    expect(preview).toMatchObject({ debuffed: true, pos: null, letterHand: null });
    expect(result.submission.debuffed).toBe(true);
    expect(result.submission.effectiveSuits).toContain('vulgar');
    expect(JSON.stringify(r)).toBe(before);

    const normalHand = tilesFor('cat');
    const normal = submitWord(
      { ...bossBlind(r, 'contract'), hand: normalHand },
      r,
      lex,
      normalHand.map((tile) => tile.id),
      makeRng('tower-normal'),
    );
    expect(normal.events.filter(
      (event) => event.kind === 'joker' && event.jokerId === 'towerOfBabel',
    )).toHaveLength(1);
  });

  it('shares Stone Tongue spelling preparation between preview and Burnt Paper submit', () => {
    const r = bossRun();
    r.jokers = [createOwnedJoker(r, 'stoneTongue')];
    const hand: Tile[] = [
      ...tilesFor('run'),
      { id: `b${idc++}`, letter: null, material: 'stone', font: 'medium' },
    ];
    const blind = { ...bossBlind(r, 'burntPaper'), hand };
    const ids = hand.map((tile) => tile.id);
    const preview = stagePreview(blind, r, lex, ids);
    const result = submitWord(blind, r, lex, ids, makeRng('stone-burnt'));

    expect(preview).toMatchObject({
      text: 'RUN', isGibberish: false, debuffed: true, pos: null, letterHand: null,
    });
    expect(result.submission).toMatchObject({ text: 'RUN', isGibberish: false, debuffed: true });
  });

  it('removes debuffed words before pattern and Unison judgment', () => {
    const r = bossRun();
    const first = play(bossBlind(r, 'whitePaper'), r, 'cat');
    const debuffed = play(first.blind, r, 'damn');
    const last = play(debuffed.blind, r, 'run');
    const end = endBlind(last.blind, r, lex);

    expect(debuffed.submission.debuffed).toBe(true);
    expect(end.judgment.match?.pattern).toBe('simple');
    expect(end.judgment.unison?.suit).toBe('standard');
  });

  it('removes debuffed words before mixed-register synergy judgment', () => {
    const r = bossRun();
    const first = play(bossBlind(r, 'whitePaper'), r, 'edict');
    const debuffed = play(first.blind, r, 'damn');
    const last = play(debuffed.blind, r, 'run');
    const end = endBlind(last.blind, r, lex);

    expect(end.judgment.registerSynergy?.id).toBe('harmony');
  });

  it('applies Orphan Line to raw history before mixed-register judgment', () => {
    const r = bossRun();
    let blind = bossBlind(r, 'orphanLine');
    ({ blind } = play(blind, r, 'edict'));
    ({ blind } = play(blind, r, 'cat'));
    ({ blind } = play(blind, r, 'damn'));

    const end = endBlind(blind, r, lex);
    expect(end.judgment.registerSynergy).toBeNull();
  });

  it('keeps Tower and Tyrant Unison-only and lets gibberish void Dadaist tags', () => {
    const towerRun = bossRun();
    towerRun.jokers = [createOwnedJoker(towerRun, 'towerOfBabel')];
    let towerBlind = bossBlind(towerRun, 'contract');
    ({ blind: towerBlind } = play(towerBlind, towerRun, 'cat'));
    ({ blind: towerBlind } = play(towerBlind, towerRun, 'edict'));
    const tower = endBlind(towerBlind, towerRun, lex).judgment;
    expect(tower.unison).not.toBeNull();
    expect(tower.registerSynergy).toBeNull();

    const tyrantRun = bossRun();
    tyrantRun.jokers = [createOwnedJoker(tyrantRun, 'tyrant')];
    let tyrantBlind = bossBlind(tyrantRun, 'contract');
    ({ blind: tyrantBlind } = play(tyrantBlind, tyrantRun, 'cat'));
    ({ blind: tyrantBlind } = play(tyrantBlind, tyrantRun, 'edict'));
    const tyrant = endBlind(tyrantBlind, tyrantRun, lex).judgment;
    expect(tyrant.unison?.suit).toBe('vulgar');
    expect(tyrant.registerSynergy).toBeNull();

    const dadaRun = bossRun();
    dadaRun.jokers = [createOwnedJoker(dadaRun, 'dadaist')];
    let dadaBlind = bossBlind(dadaRun, 'contract');
    ({ blind: dadaBlind } = play(dadaBlind, dadaRun, 'zzz'));
    ({ blind: dadaBlind } = play(dadaBlind, dadaRun, 'qqq'));
    const dada = endBlind(dadaBlind, dadaRun, lex).judgment;
    expect(dada.unison).toBeNull();
    expect(dada.registerSynergy).toBeNull();
  });

  it('does not award no-pattern Emoji score when every play is debuffed', () => {
    const r = bossRun();
    r.jokers = [createOwnedJoker(r, 'brokenSentence')];
    const result = play(bossBlind(r, 'whitePaper'), r, 'damn');
    const end = endBlind(result.blind, { ...r, jokers: result.jokers }, lex);

    expect(result.blind.projectedScore).toBe(0);
    expect(end.finalScore).toBe(0);
    expect(end.breakdown.jokerTriggers).toBeUndefined();
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
    expect(second.submission.debuffed).toBe(true);
  });

  it('Bond (채권): each hand played drains exactly $1 regardless of tile count', () => {
    const r = bossRun();
    expect(play(bossBlind(r, 'bond'), r, 'cat').goldDelta).toBe(-1);
  });

  it('Unopened Letter (미개봉 편지): each play dumps up to 4 extra random hand tiles, refilled', () => {
    const r = bossRun();
    const b = startBlind(r, makeRng('letter'), { kind: 'boss', bossId: 'letter', target: 100_000 });
    const ids = b.hand.slice(0, 3).map((t) => t.id);
    const res = submitWord(b, r, lex, ids, makeRng('t'));
    // 3 played + 4 dumped by Letter = 7 tiles have left play this blind
    expect(res.blind.discardedThisBlind.length).toBe(7);
    expect(res.bossDiscardedTiles).toHaveLength(4);
    expect(res.bossDiscardedTiles.every((tile) =>
      res.blind.discardedThisBlind.some((discarded) => discarded.id === tile.id))).toBe(true);
    // dumped tiles are replaced, so hand size is preserved
    expect(res.blind.hand.length).toBe(b.hand.length);
  });

  it('Unopened Letter discards grow Discarded Draft without counting played tiles', () => {
    const r = bossRun();
    r.jokers = [{ defId: 'discardedDraft', edition: 'base', state: {} }];
    const b = startBlind(r, makeRng('letter-discarded-draft'), {
      kind: 'boss', bossId: 'letter', target: 100_000,
    });
    const ids = b.hand.slice(0, 3).map((tile) => tile.id);
    const first = submitWord(b, r, lex, ids, makeRng('letter-discarded-draft-first'));

    expect(first.jokers[0]?.state.chips).toBe(
      4 * BALANCE.jokers.discardedDraft.chipsPerTile,
    );

    const secondRun = { ...r, jokers: first.jokers };
    const second = play(first.blind, secondRun, 'cat');
    expect(second.events).toContainEqual(expect.objectContaining({
      kind: 'joker',
      jokerId: 'discardedDraft',
      chipsDelta: 4 * BALANCE.jokers.discardedDraft.chipsPerTile,
    }));
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
