import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { JokerBus } from '../src/engine/events';
import {
  JOKER_REGISTRY,
  onTilesCreated,
} from '../src/engine/jokers';
import { startBlind } from '../src/engine/loop';
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

  it('Blackletter Engine queues a retrigger on each Black tile', () => {
    const run = newRun('blackletter');
    run.jokers = [owned('blackletterEngine')];
    const blind = startBlind(run, makeRng('blackletter'));
    const submission = word('INK');
    submission.tiles[1] = { ...submission.tiles[1]!, font: 'black' };
    const ctx = wordCtx(submission);
    bus.emit('wordRules', { run, blind, ctx }, run.jokers);
    expect(ctx.tileRetriggers?.get(submission.tiles[1]!.id)).toEqual(['blackletterEngine']);
  });

  it('Living Type grows from the shared permanent-creation event', () => {
    const run = newRun('living-type');
    run.jokers = [owned('livingType')];
    const next = onTilesCreated(run, 3);
    expect(next.jokers[0]?.state.chips).toBe(3 * BALANCE.jokers.livingType.chipsPerTile);
  });

  it('Term Insurance cancels its configured destructions, scores each, then destroys itself', () => {
    const run = newRun('insurance');
    run.jokers = [owned('termInsurance')];
    const blind = startBlind(run, makeRng('insurance'));
    const ctx = wordCtx(word('CAT'));
    for (let index = 0; index < BALANCE.jokers.termInsurance.prevents; index++) {
      const payload = {
        run, blind, ctx, tile: ctx.submission.tiles[index % ctx.submission.tiles.length]!,
        cause: 'glass' as const, cancelled: false,
      };
      bus.emit('tileDestroying', payload, run.jokers);
      expect(payload.cancelled).toBe(true);
    }
    expect(ctx.chips).toBe(
      BALANCE.jokers.termInsurance.prevents * BALANCE.jokers.termInsurance.chipsPerPrevent,
    );
    expect(run.jokers[0]?.state.destroyed).toBe(1);
  });

  it('Copy Editor alone relaxes the central duplicate gate', () => {
    const run = newRun('copy-editor');
    run.jokers = [owned('miser')];
    expect(canOwnJoker(run, 'miser')).toBe(false);
    run.jokers.push(owned('copyEditor'));
    expect(canOwnJoker(run, 'miser')).toBe(true);
  });
});
