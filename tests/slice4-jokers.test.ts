import { describe, it, expect } from 'vitest';
import { JokerBus } from '../src/engine/events';
import { JOKER_REGISTRY } from '../src/engine/jokers';
import { newRun } from '../src/engine/run';
import { startBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import type {
  BlindState,
  Letter,
  OwnedJoker,
  SentenceScoringContext,
  Suit,
  Tile,
  WordScoringContext,
  WordSubmission,
} from '../src/engine/types';

const bus = new JokerBus(JOKER_REGISTRY);
const run = newRun('j');
const blind = startBlind(run, makeRng('j'));
const owned = (defId: string): OwnedJoker[] => [{ defId, state: {} }];

let idc = 0;
const tilesFor = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `j${idc++}`,
    letter: c as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

const sub = (text: string, suit: Suit | null, gib = false): WordSubmission => ({
  tiles: tilesFor(text),
  text,
  isGibberish: gib,
  suit,
  posUsed: null,
  settledScore: 0,
});

const wordCtx = (submission: WordSubmission, chips: number, mult: number): WordScoringContext => ({
  submission,
  chips,
  mult,
});

const emitWord = (defId: string, ctx: WordScoringContext, b: BlindState = blind) =>
  bus.emit('wordScoring', { run, blind: b, ctx }, owned(defId));

// Per-letter jokers hook tileScoring (item 3) — fire it once per tile in the word.
const emitTiles = (defId: string, ctx: WordScoringContext, b: BlindState = blind) => {
  for (const tile of ctx.submission.tiles) {
    bus.emit('tileScoring', { run, blind: b, ctx, tile }, owned(defId));
  }
};

const sentCtx = (over: Partial<SentenceScoringContext>): SentenceScoringContext => ({
  sequence: [],
  match: null,
  unison: null,
  totalBefore: 100,
  flatBonus: 0,
  totalMultiplier: 1,
  ...over,
});

describe('slice4 jokers — layer 1 (letter/tile), fire on gibberish too (GDD §6.4, §11.2)', () => {
  it('#1 Vowel Praise: +2 Mult per vowel (per-tile)', () => {
    const ctx = wordCtx(sub('EAT', 'standard'), 3, 1); // E, A → 2 vowels
    emitTiles('vowelPraise', ctx);
    expect(ctx.mult).toBe(1 + 2 * 2);
  });

  it('#2 Consonant Bricklayer: +4 Chips per consonant (per-tile)', () => {
    const ctx = wordCtx(sub('CAT', 'standard'), 5, 1); // C, T → 2 consonants
    emitTiles('consonantBricklayer', ctx);
    expect(ctx.chips).toBe(5 + 4 * 2);
  });

  it('#10 Jack of All Trades: unconditional +4 Mult', () => {
    const ctx = wordCtx(sub('CAT', 'standard'), 5, 1);
    emitWord('jackOfAllTrades', ctx);
    expect(ctx.mult).toBe(1 + 4);
  });

  it('layer-1 jokers still fire on a gibberish hole (letters are intrinsic)', () => {
    const ctx = wordCtx(sub('ZZQ', null, true), 30, 1); // 0 vowels, 3 consonants
    emitTiles('vowelPraise', ctx);
    emitTiles('consonantBricklayer', ctx);
    expect(ctx.mult).toBe(1); // +0 vowels
    expect(ctx.chips).toBe(30 + 4 * 3);
  });
});

describe('slice4 jokers — layer 2 (suit), never fire on gibberish (GDD §11.3)', () => {
  it('#12 Hipster: +7 Mult on a Slang word', () => {
    const ctx = wordCtx(sub('COOL', 'slang'), 6, 2);
    emitWord('hipster', ctx);
    expect(ctx.mult).toBe(2 + 7);
  });

  it('#12 Hipster: no effect on a non-Slang word', () => {
    const ctx = wordCtx(sub('CAT', 'standard'), 5, 1);
    emitWord('hipster', ctx);
    expect(ctx.mult).toBe(1);
  });

  it('#12 Hipster: no effect on gibberish (suit is null)', () => {
    const ctx = wordCtx(sub('ZZQ', null, true), 30, 1);
    emitWord('hipster', ctx);
    expect(ctx.mult).toBe(1);
  });
});

describe('slice4 jokers — layer 3 (sentence/phase) (GDD §11.4)', () => {
  it('#22 Grammarian: ×2 Mult when a pattern completed', () => {
    const ctx = sentCtx({ match: { pattern: 'simple', rank: 4, absorbedModifiers: 0 } });
    bus.emit('sentenceScoring', { run, blind, ctx }, owned('grammarian'));
    expect(ctx.totalMultiplier).toBe(2);
  });

  it('#22 Grammarian: no effect when there is no pattern', () => {
    const ctx = sentCtx({ match: null });
    bus.emit('sentenceScoring', { run, blind, ctx }, owned('grammarian'));
    expect(ctx.totalMultiplier).toBe(1);
  });

  // Rush Specialist reworked (item 6): a per-WORD ×Mult (wordScoring), scaling with
  // the phases that will REMAIN after this word (blind is pre-increment, so −1).
  it('#24 Rush Specialist: ×(1 + 0.5·phasesLeft) on each word — 3 will remain → ×2.5', () => {
    const ctx = wordCtx(sub('CAT', 'standard'), 5, 1);
    const early: BlindState = { ...blind, phasesUsed: 0, phasesTotal: 4 }; // 3 will remain
    emitWord('rushSpecialist', ctx, early);
    expect(ctx.mult).toBe(2.5);
  });

  it('#24 Rush Specialist: fewer phases left → smaller mult — 1 will remain → ×1.5', () => {
    const ctx = wordCtx(sub('CAT', 'standard'), 5, 1);
    const late: BlindState = { ...blind, phasesUsed: 2, phasesTotal: 4 }; // 1 will remain
    emitWord('rushSpecialist', ctx, late);
    expect(ctx.mult).toBe(1.5);
  });

  it('#24 Rush Specialist: nothing on the last phase (0 will remain)', () => {
    const ctx = wordCtx(sub('CAT', 'standard'), 5, 1);
    const done: BlindState = { ...blind, phasesUsed: 3, phasesTotal: 4 }; // 0 will remain
    emitWord('rushSpecialist', ctx, done);
    expect(ctx.mult).toBe(1);
  });
});

describe('slice4 jokers — registry', () => {
  it('registers all six proof-set jokers keyed by id', () => {
    for (const id of [
      'vowelPraise',
      'consonantBricklayer',
      'jackOfAllTrades',
      'hipster',
      'grammarian',
      'rushSpecialist',
    ]) {
      expect(JOKER_REGISTRY.get(id)?.id).toBe(id);
    }
  });
});
