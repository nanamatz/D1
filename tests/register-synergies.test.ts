import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { makeLexicon } from '../src/engine/lexicon';
import { finalizeScore, judgeSentence } from '../src/engine/patterns';
import { newRun } from '../src/engine/run';
import type { Suit, WordSubmission } from '../src/engine/types';

const lexicon = makeLexicon([], {
  noun: { suit: 'standard', pos: ['noun'] },
  verb: { suit: 'standard', pos: ['verbIntransitive'] },
  extra: { suit: 'standard', pos: ['adverb'] },
  hole: { suit: 'standard', pos: ['noun'] },
});

const word = (
  text: string,
  suit: Suit | null,
  effectiveSuits?: Suit[],
  isGibberish = false,
): WordSubmission => ({
  text,
  tiles: [],
  suit,
  ...(effectiveSuits ? { effectiveSuits } : {}),
  isGibberish,
  posUsed: null,
  settledScore: 0,
});

const judgment = (...words: WordSubmission[]) => judgeSentence(words, lexicon);

describe('register synergy judgment', () => {
  it.each([
    ['standard', 'formal', 'harmony'],
    ['slang', 'vulgar', 'contrast'],
    ['formal', 'vulgar', 'whiplash'],
    ['standard', 'slang', null],
    ['standard', 'vulgar', null],
    ['formal', 'slang', null],
  ] as const)('judges the exact pair %s + %s as %s', (a, b, expected) => {
    expect(judgment(word('noun', a), word('verb', b)).registerSynergy?.id ?? null)
      .toBe(expected);
  });

  it('ignores order and repetition, and requires at least two valid words', () => {
    expect(judgment(
      word('noun', 'formal'),
      word('verb', 'standard'),
      word('extra', 'formal'),
    ).registerSynergy?.id).toBe('harmony');
    expect(judgment(word('noun', 'formal')).registerSynergy).toBeNull();
  });

  it('uses Mishmash for any union of three or four registers', () => {
    expect(judgment(
      word('noun', 'standard'), word('verb', 'formal'), word('extra', 'slang'),
    ).registerSynergy?.id).toBe('mishmash');
    expect(judgment(
      word('noun', 'standard', ['standard', 'formal']),
      word('verb', 'slang', ['slang', 'vulgar']),
    ).registerSynergy?.id).toBe('mishmash');
  });

  it('gives Unison priority for shared multi-suit membership, including Tower membership', () => {
    const bridge = judgment(
      word('noun', 'standard', ['standard', 'formal']),
      word('verb', 'slang', ['formal', 'slang']),
    );
    expect(bridge.unison?.suit).toBe('formal');
    expect(bridge.registerSynergy).toBeNull();

    const all: Suit[] = ['standard', 'formal', 'slang', 'vulgar'];
    const tower = judgment(word('noun', 'standard', all), word('verb', 'formal', all));
    expect(tower.unison).not.toBeNull();
    expect(tower.registerSynergy).toBeNull();
  });

  it('voids every sentence judgment on a gibberish hole, regardless of effective tags', () => {
    const result = judgment(
      word('noun', 'formal'),
      word('hole', null, ['vulgar'], true),
    );
    expect(result.match).toBeNull();
    expect(result.unison).toBeNull();
    expect(result.registerSynergy).toBeNull();
  });

  it('falls back to the legacy single suit when effectiveSuits is absent', () => {
    const result = judgment(word('noun', 'formal'), word('verb', 'vulgar'));
    expect(result.registerSynergy).toEqual({
      id: 'whiplash',
      chipsFactor: BALANCE.registerSynergies.whiplash.chipsFactor,
    });
  });
});

describe('register synergy scoring', () => {
  const levels = newRun('register-synergy-levels').patternLevels;

  it('multiplies committed + raw pattern Chips before the existing sentence Mult', () => {
    const result = finalizeScore(100, {
      match: {
        pattern: 'simple',
        rank: BALANCE.patterns.simple.rank,
        absorbedModifiers: 0,
      },
      unison: null,
      registerSynergy: { id: 'harmony', chipsFactor: 1.25 },
    }, levels);
    expect(result.sentenceChips).toBe(68.75);
    expect(result.registerSynergyChipsFactor).toBe(1.25);
    expect(result.total).toBe(168.75);
  });

  it('includes absorbed modifier Chips in the multiplied base axis', () => {
    const result = finalizeScore(100, {
      match: {
        pattern: 'simple',
        rank: BALANCE.patterns.simple.rank,
        absorbedModifiers: 2,
      },
      unison: null,
      registerSynergy: { id: 'harmony', chipsFactor: 1.25 },
    }, levels);
    expect(result.total).toBe((100 + 35 + 2 * BALANCE.modifierAbsorption.chips) * 1.25);
  });

  it.each([
    ['harmony', 1.25],
    ['contrast', 1.5],
    ['whiplash', 1.75],
    ['mishmash', 2],
  ] as const)('%s applies ×%s Chips without a pattern', (id, factor) => {
    const result = finalizeScore(100, {
      match: null,
      unison: null,
      registerSynergy: { id, chipsFactor: factor },
    }, levels);
    expect(result.total).toBe(100 * factor);
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('stays finite at a zero committed axis', () => {
    const result = finalizeScore(0, {
      match: null,
      unison: null,
      registerSynergy: { id: 'mishmash', chipsFactor: 2 },
    }, levels);
    expect(result).toMatchObject({ sentenceChips: 0, bonus: 0, total: 0 });
    expect(Number.isFinite(result.sentenceChips)).toBe(true);
  });
});
