import { describe, expect, it } from 'vitest';
import { startBlind } from '../src/engine/loop';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import type { GameState } from '../src/ui/useGame';
import { completePendingPackTransition } from '../src/ui/useGame';

describe('free skip-pack transition', () => {
  it('constructs the next blind atomically from the pack-mutated pouch', () => {
    const original = newRun('free-pack-atomic');
    const staleBlind = startBlind(original, makeRng('stale-blind'));
    const kept = original.bag.slice(0, 5);
    const run = { ...original, blindIndex: 1 as const, bag: kept };
    const state = {
      seed: 'free-pack-atomic',
      rngCounter: 12,
      run,
      blind: staleBlind,
      phase: 'shop',
      pack: null,
      pendingBlindAfterPack: true,
      selected: ['stale-selection'],
      hint: null,
      message: null,
      lastEvents: [],
      bossDiscard: null,
      settleId: 0,
      committedBefore: 0,
      lastPlayed: null,
      pendingEnd: false,
      settleComplete: true,
      finalScore: null,
      sentenceBonus: null,
    } as unknown as GameState;

    const next = completePendingPackTransition(state);

    expect(next.phase).toBe('blindselect');
    expect(next.pendingBlindAfterPack).toBe(false);
    expect(next.rngCounter).toBe(13);
    expect(next.blind).not.toBe(staleBlind);
    expect(next.blind.hand.map((tile) => tile.id).sort()).toEqual(
      kept.map((tile) => tile.id).sort(),
    );
    expect(next.blind.bag).toEqual([]);
  });
});
