import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { JokerBus, type EngineEvents } from '../src/engine/events';
import {
  JOKER_REGISTRY,
  onTilesCreated,
  onTilesDestroyed,
} from '../src/engine/jokers';
import { discardTiles, startBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type {
  Letter,
  OwnedJoker,
  SentenceScoringContext,
  Tile,
  WordScoringContext,
  WordSubmission,
} from '../src/engine/types';
import { canOwnJoker } from '../src/engine/vouchers';

const bus = new JokerBus(JOKER_REGISTRY);
const tile = (id: string, letter: Letter | null, patch: Partial<Tile> = {}): Tile => ({
  id, letter, material: 'ceramic', font: 'medium', edition: 'base', ...patch,
});
const word = (text: string): WordSubmission => ({
  text,
  tiles: [...text].map((letter, index) => tile(`${text}-${index}`, letter as Letter)),
  isGibberish: false,
  suit: 'standard',
  posUsed: null,
  settledScore: 0,
});
const owned = (defId: string): OwnedJoker => ({ defId, edition: 'base', state: {} });
const wordCtx = (submission: WordSubmission): WordScoringContext => ({
  submission, chips: 0, mult: 1, scoringVowels: new Set(['A', 'E', 'I', 'O', 'U']),
  scoringSuits: new Set(['standard']), tileRetriggers: new Map(), scoreBonus: 0,
});

describe('promoted Emoji Tile hooks', () => {
  it('Stone Tongue removes up to two Stone tiles only from the spelling projection', () => {
    const run = newRun('stone-tongue');
    run.jokers = [owned('stoneTongue')];
    const blind = startBlind(run, makeRng('stone-tongue'));
    const stone = tile('stone', null, { material: 'stone', letterBeforeStone: 'X' });
    const stone2 = tile('stone2', null, { material: 'stone', letterBeforeStone: 'Y' });
    const tiles = [tile('c', 'C'), stone, tile('a', 'A'), stone2, tile('t', 'T')];
    const payload = { run, blind, tiles, spellingTiles: tiles.slice() };
    bus.emit('wordPrepare', payload, run.jokers);
    expect(payload.spellingTiles.map((entry) => entry.id)).toEqual(['c', 'a', 't']);
    expect(tiles).toHaveLength(5);
  });

  it('Acrostic Poet triples a sentence whose initials form a valid word', () => {
    const run = newRun('acrostic');
    run.jokers = [owned('acrosticPoet')];
    const blind = startBlind(run, makeRng('acrostic'));
    const ctx: SentenceScoringContext = {
      sequence: [word('cat'), word('apple'), word('tree')],
      match: null, unison: null, totalBefore: 0, sentenceChips: 10, sentenceMult: 2,
    };
    bus.emit('sentenceScoring', {
      run, blind, ctx,
      lookup: (text) => text === 'cat'
        ? { word: text, suit: 'standard', pos: [] }
        : null,
    }, run.jokers);
    expect(ctx.sentenceMult).toBe(2 * BALANCE.jokers.acrosticPoet.factor);
  });

  it('Blackletter Engine enhances surviving Medium tiles after the first word settles', () => {
    const run = newRun('blackletter');
    run.jokers = [owned('blackletterEngine')];
    const blind = startBlind(run, makeRng('blackletter'));
    const submission = word('INK');
    submission.tiles[1] = { ...submission.tiles[1]!, font: 'inline' };
    const enhancedTiles: NonNullable<EngineEvents['tilesPlayed']['enhancedTiles']> = [];
    bus.emit('tilesPlayed', {
      run,
      blind: { ...blind, sequence: [submission] },
      tiles: submission.tiles,
      enhancedTiles,
    }, run.jokers);
    expect(submission.tiles.map((tile) => tile.font)).toEqual(['black', 'inline', 'black']);
    expect(enhancedTiles.map(({ tile }) => tile.id)).toEqual([
      submission.tiles[0]!.id,
      submission.tiles[2]!.id,
    ]);
  });

  it('Living Type grows from the shared permanent-creation event', () => {
    const run = newRun('living-type');
    run.jokers = [owned('livingType')];
    const next = onTilesCreated(run, 3);
    expect(next.jokers[0]?.state.chips).toBe(3 * BALANCE.jokers.livingType.chipsPerTile);
  });

  it('Term Insurance allows destruction and grows +0.2 Mult per destroyed tile', () => {
    const run = newRun('insurance');
    run.jokers = [owned('termInsurance')];
    const blind = startBlind(run, makeRng('insurance'));
    const ctx = wordCtx(word('CAT'));
    const payload = {
      run, blind, ctx, tile: ctx.submission.tiles[0]!,
      cause: 'glass' as const, cancelled: false,
    };
    bus.emit('tileDestroying', payload, run.jokers);
    expect(payload.cancelled).toBe(false);
    const grown = onTilesDestroyed(onTilesDestroyed(run, 1), 1);
    const next = wordCtx(word('DOG'));
    bus.emit('wordScoring', { run: grown, blind, ctx: next }, grown.jokers);
    expect(ctx.chips).toBe(0);
    expect(next.mult).toBeCloseTo(
      BALANCE.jokers.termInsurance.baseFactor
      + 2 * BALANCE.jokers.termInsurance.factorPerTile,
    );
    expect(JOKER_REGISTRY.get('termInsurance')).toMatchObject({
      multOperation: 'multiply',
    });
  });

  it('Copy Editor relaxes the central duplicate gate while owned', () => {
    const run = newRun('copy-editor');
    run.jokers = [owned('miser')];
    expect(canOwnJoker(run, 'miser')).toBe(false);
    run.jokers.push(owned('copyEditor'));
    expect(canOwnJoker(run, 'miser')).toBe(true);
  });

  it('Clean Copy checks remaining discards at scoring time', () => {
    const run = newRun('clean-copy');
    run.jokers = [owned('cleanCopy')];
    const blind = startBlind(run, makeRng('clean-copy'));
    const active = wordCtx(word('CAT'));
    bus.emit('wordScoring', { run, blind: { ...blind, discardsLeft: 4 }, ctx: active }, run.jokers);
    expect(active.mult).toBe(1 + BALANCE.jokers.cleanCopy.mult);

    const spent = wordCtx(word('CAT'));
    bus.emit('wordScoring', { run, blind: { ...blind, discardsLeft: 3 }, ctx: spent }, run.jokers);
    expect(spent.mult).toBe(1);
  });

  it('Discarded Draft grows from tiles actually discarded by the player', () => {
    const run = newRun('discarded-draft');
    run.jokers = [owned('discardedDraft')];
    const blind = startBlind(run, makeRng('discarded-draft'));
    const discarded = blind.hand.slice(0, 3);
    const result = discardTiles(
      blind,
      run,
      discarded.map((entry) => entry.id),
      makeRng('discarded-draft-use'),
    );
    expect(result.jokers[0]?.state.chips)
      .toBe(3 * BALANCE.jokers.discardedDraft.chipsPerTile);
  });

  it('Bad Review never subtracts another effect Mult', () => {
    const run = newRun('bad-review');
    run.jokers = [owned('badReview')];
    const blind = startBlind(run, makeRng('bad-review'));
    const gibberish = word('ZZZ');
    gibberish.isGibberish = true;
    gibberish.suit = null;
    const ctx = { ...wordCtx(gibberish), mult: 9 };
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(9);
    expect(ctx.goldDelta).toBe(BALANCE.jokers.badReview.gold);
  });

  it('Exacting Critic counts owned Uncommon Emoji Tiles regardless of side', () => {
    const run = newRun('exacting-critic');
    run.jokers = [
      owned('formalInvitation'),
      owned('exactingCritic'),
      owned('slangDictionary'),
      owned('miser'),
    ];
    const blind = startBlind(run, makeRng('exacting-critic'));
    const ctx = wordCtx(word('CAT'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(BALANCE.jokers.exactingCritic.factorPerUncommon ** 2);
  });

  it('Word Hunter grows by +0.1 per unique word and recomputes from run history', () => {
    const run = newRun('word-hunter');
    run.jokers = [owned('wordHunter')];
    const blind = startBlind(run, makeRng('word-hunter'));
    const ctx = wordCtx(word('CAT'));
    bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBeCloseTo(
      BALANCE.jokers.wordHunter.baseFactor + BALANCE.jokers.wordHunter.factorPerNewWord,
    );

    const repeat = wordCtx(word('CAT'));
    run.playedWords = ['cat'];
    bus.emit('wordScoring', { run, blind, ctx: repeat }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBeCloseTo(1.1);

    const next = wordCtx(word('DOG'));
    bus.emit('wordScoring', { run, blind, ctx: next }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBeCloseTo(1.2);

    run.jokers[0]!.state.factor = 3.7;
    run.playedWords = ['cat', 'dog'];
    const saved = wordCtx(word('SUN'));
    bus.emit('wordScoring', { run, blind, ctx: saved }, run.jokers);
    expect(run.jokers[0]!.state.factor).toBeCloseTo(1.3);
    expect(saved.mult).toBeCloseTo(1.3);
  });
});
