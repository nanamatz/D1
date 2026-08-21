import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { BOSS_REGISTRY, enterBossBlind } from '../src/engine/bosses';
import { createOwnedJoker } from '../src/engine/jokers';
import { discardTiles, endBlind, startBlind, submitWord } from '../src/engine/loop';
import { makeLexicon } from '../src/engine/lexicon';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import {
  consumeNextBlindBonus,
  skipCurrentBlind,
} from '../src/engine/skipRewards';
import { stagePreview } from '../src/ui/game';
import type { BlindState, Letter, RunState, Tile } from '../src/engine/types';

const lex = makeLexicon([], {
  ant: { suit: 'standard', pos: ['noun'] },
  ate: { suit: 'standard', pos: ['verbTransitive'] },
  bat: { suit: 'standard', pos: ['noun'] },
  cat: { suit: 'standard', pos: ['noun'] },
  dog: { suit: 'standard', pos: ['noun'] },
  eat: { suit: 'standard', pos: ['verbTransitive'] },
  run: { suit: 'standard', pos: ['verbIntransitive'] },
  stone: { suit: 'standard', pos: ['noun'] },
  tone: { suit: 'standard', pos: ['noun'] },
});

let serial = 0;
const tilesFor = (word: string): Tile[] => [...word.toUpperCase()].map((letter) => ({
  id: `lore-${serial++}`,
  letter: letter as Letter,
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
}));

const play = (blind: BlindState, run: RunState, word: string) => {
  const hand = tilesFor(word);
  return submitWord(
    { ...blind, hand },
    run,
    lex,
    hand.map((tile) => tile.id),
    makeRng(`play-${word}-${serial}`),
  );
};

const runWith = (id: string): RunState => {
  const run = newRun(`lore-${id}`);
  run.jokers = [createOwnedJoker(run, id)];
  return run;
};

describe('alphabet-lore Emoji Tiles', () => {
  it('Gematria adds Mult for equal intrinsic letter Chips', () => {
    const run = runWith('gematria');
    const blind = startBlind(run, makeRng('gematria'), { target: 1_000_000 });
    const first = play(blind, run, 'cat');
    const second = play(first.blind, { ...run, jokers: first.jokers }, 'dog');
    expect(second.events).toContainEqual(expect.objectContaining({
      kind: 'joker', jokerId: 'gematria', multDelta: BALANCE.jokers.gematria.mult,
    }));
  });

  it("Cadmus's Teeth counts each discarded alphabet letter once across the run", () => {
    const run = runWith('cadmusTeeth');
    const base = startBlind(run, makeRng('cadmus'));
    const hand = [...tilesFor('aab'), ...base.hand.slice(3)];
    const result = discardTiles(
      { ...base, hand },
      run,
      hand.slice(0, 3).map((tile) => tile.id),
      makeRng('cadmus-discard'),
    );
    expect(result.discardedLetters.sort()).toEqual(['A', 'B']);
    expect(result.jokers[0]!.state.chips).toBe(BALANCE.jokers.cadmusTeeth.chipsPerLetter * 2);

    const lateRun = { ...newRun('cadmus-late'), discardedLetters: result.discardedLetters };
    expect(createOwnedJoker(lateRun, 'cadmusTeeth').state.chips).toBe(
      BALANCE.jokers.cadmusTeeth.chipsPerLetter * 2,
    );
  });

  it('Golem, Temurah, and Iota Stroke recognize their dictionary transformations', () => {
    const golemRun = runWith('golem');
    const golem = play(startBlind(golemRun, makeRng('golem')), golemRun, 'stone');
    expect(golem.events).toContainEqual(expect.objectContaining({
      kind: 'joker', jokerId: 'golem', multFactor: BALANCE.jokers.golem.factor,
    }));

    const temurahRun = runWith('temurah');
    const eat = play(startBlind(temurahRun, makeRng('temurah')), temurahRun, 'eat');
    const ate = play(eat.blind, { ...temurahRun, jokers: eat.jokers }, 'ate');
    expect(ate.events).toContainEqual(expect.objectContaining({
      kind: 'joker', jokerId: 'temurah', multFactor: BALANCE.jokers.temurah.factor,
    }));

    const iotaRun = runWith('iotaStroke');
    const cat = play(startBlind(iotaRun, makeRng('iota')), iotaRun, 'cat');
    const bat = play(cat.blind, { ...iotaRun, jokers: cat.jokers }, 'bat');
    expect(bat.events).toContainEqual(expect.objectContaining({
      kind: 'joker', jokerId: 'iotaStroke', multFactor: BALANCE.jokers.iotaStroke.factor,
    }));
  });

  it('Alphabet Poet multiplies the sentence bonus for ascending initials', () => {
    const run = runWith('alphabetPoet');
    let blind = startBlind(run, makeRng('alphabet-poet'), { target: 1_000_000 });
    let currentRun = run;
    for (const word of ['ant', 'bat', 'cat']) {
      const result = play(blind, currentRun, word);
      blind = result.blind;
      currentRun = { ...currentRun, jokers: result.jokers };
    }
    const end = endBlind(blind, currentRun, lex);
    expect(end.breakdown.effectMult).toBe(BALANCE.jokers.alphabetPoet.factor);
    expect(end.breakdown.jokerTriggers?.[0]?.jokerId).toBe('alphabetPoet');
  });
});

describe('alphabet-lore bosses', () => {
  it('Dead Letter seeds a repeated letter and debuffs a valid word containing it', () => {
    const run = newRun('dead-letter');
    const started = startBlind(run, makeRng('dead-letter-start'), {
      kind: 'boss', bossId: 'deadLetter', target: 1_000_000,
    });
    const entered = enterBossBlind(run, started, makeRng('dead-letter-enter'));
    expect(entered.blind.deadLetter).toMatch(/^[A-Z]$/);
    const letter = entered.blind.deadLetter!;
    const word = letter.toLowerCase();
    const singleLex = makeLexicon([], { [word]: { suit: 'standard', pos: ['noun'] } });
    const tile = tilesFor(letter)[0]!;
    const result = submitWord(
      { ...entered.blind, hand: [tile] }, entered.run, singleLex, [tile.id], makeRng('dead-letter-play'),
    );
    expect(result.submission.debuffed).toBe(true);
    expect(result.submission.settledScore).toBe(0);
  });

  it('Stereotype Plate blocks hands shorter than the longest valid word this Chapter', () => {
    const run = { ...newRun('stereotype'), wordsThisAnte: ['cat', 'stone'] };
    const blind = startBlind(run, makeRng('stereotype'), {
      kind: 'boss', bossId: 'stereotypePlate', target: 1_000_000,
    });
    const staged = tilesFor('dog');
    expect(stagePreview(
      { ...blind, hand: staged },
      run,
      lex,
      staged.map((tile) => tile.id),
    )?.blocked).toBe(true);
    expect(() => play(blind, run, 'dog')).toThrow('boss: this word cannot be submitted');
    expect(play(blind, run, 'stone').submission.settledScore).toBeGreaterThan(0);
  });

  it('Orphan Line excludes only the first word from pattern and Unison judgment', () => {
    const run = newRun('orphan');
    const plain = startBlind(run, makeRng('plain'), { target: 1_000_000 });
    const plainCat = play(plain, run, 'cat');
    const plainRun = play(plainCat.blind, run, 'run');
    expect(endBlind(plainRun.blind, run, lex).judgment.match?.pattern).toBe('simple');

    const orphan = startBlind(run, makeRng('orphan'), {
      kind: 'boss', bossId: 'orphanLine', target: 1_000_000,
    });
    const orphanCat = play(orphan, run, 'cat');
    const orphanRun = play(orphanCat.blind, run, 'run');
    const end = endBlind(orphanRun.blind, run, lex);
    expect(orphanCat.submission.settledScore).toBeGreaterThan(0);
    expect(end.judgment.match).toBeNull();
    expect(end.judgment.unison).toBeNull();
  });

  it('Orphan Line removes the first raw submission before debuff filtering', () => {
    const run = newRun('orphan-debuffed-first');
    const orphan = {
      ...startBlind(run, makeRng('orphan-debuffed-first'), {
        kind: 'boss', bossId: 'orphanLine', target: 1_000_000,
      }),
      lipogramLetters: ['D' as const],
    };
    const first = play(orphan, run, 'dog');
    const second = play(first.blind, run, 'cat');
    const third = play(second.blind, run, 'run');
    const end = endBlind(third.blind, run, lex);

    expect(first.submission.debuffed).toBe(true);
    expect(end.judgment.match?.pattern).toBe('simple');
    expect(end.judgment.unison?.suit).toBe('standard');
  });
});

describe('alphabet-lore Tags', () => {
  it('Scarlet Tag retriggers each disclosed-letter tile once', () => {
    const run = newRun('scarlet');
    run.nextBlindBonus.scarletLetters = ['A'];
    const blind = startBlind(run, makeRng('scarlet'));
    const result = play(blind, run, 'cat');
    const a = result.submission.tiles.find((tile) => tile.letter === 'A')!;
    expect(result.events.filter((event) => event.kind === 'tile' && event.tileId === a.id)).toHaveLength(2);
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: 'tag', tagId: 'scarletTag', tileId: a.id, retrigger: true,
    }));
  });

  it('Lipogram Tag cuts the target and debuffs matching valid words', () => {
    const run: RunState = {
      ...newRun('lipogram'),
      skipOffers: [{ id: 'lipogramTag', letter: 'A' }, { id: 'copyPass' }],
    };
    const skipped = skipCurrentBlind(run, makeRng('lipogram-skip')).run;
    const tagged = startBlind(skipped, makeRng('lipogram-blind'));
    const plain = startBlind(consumeNextBlindBonus(skipped), makeRng('lipogram-blind'));
    expect(tagged.target).toBe(Math.round(plain.target * BALANCE.skipRewards.lipogramTargetMultiplier));
    const hand = tilesFor('cat');
    const staged = { ...tagged, hand };
    expect(stagePreview(staged, skipped, lex, hand.map((tile) => tile.id))?.debuffed)
      .toBe(true);
    const result = submitWord(
      staged, skipped, lex, hand.map((tile) => tile.id), makeRng('lipogram-play'),
    );
    expect(result.submission.debuffed).toBe(true);
    expect(result.events).toEqual([{ kind: 'settle', chips: 0, mult: 0, total: 0 }]);
  });

});

describe('alphabet-lore content registries', () => {
  it('registers exactly the requested additions', () => {
    expect(BOSS_REGISTRY.has('deadLetter')).toBe(true);
    expect(BOSS_REGISTRY.has('stereotypePlate')).toBe(true);
    expect(BOSS_REGISTRY.has('orphanLine')).toBe(true);
  });
});
