import { describe, it, expect } from 'vitest';
import { newRun } from '../src/engine/run';
import { startBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { kindForIndex, currentTarget, resolveBlind } from '../src/engine/progression';
import { blindTarget } from '../src/engine/economy';
import type { BlindState, RunState } from '../src/engine/types';

const blindWith = (over: Partial<BlindState>): BlindState => ({
  kind: 'small',
  bossId: null,
  target: 100,
  phasesTotal: 4,
  phasesUsed: 0,
  exchangesLeft: 3,
  exchangeSize: 5,
  committedScore: 0,
  projectedScore: 0,
  sequence: [],
  bag: [],
  hand: [],
  discardedThisBlind: [],
  ...over,
});

describe('slice5 progression — blind order within an ante (GDD §8.1)', () => {
  it('maps blind index 0/1/2 → small/big/boss', () => {
    expect(kindForIndex(0)).toBe('small');
    expect(kindForIndex(1)).toBe('big');
    expect(kindForIndex(2)).toBe('boss');
  });

  it('currentTarget reflects the run ante and blind index', () => {
    const run: RunState = { ...newRun('t'), ante: 2, blindIndex: 1 };
    expect(currentTarget(run)).toBe(blindTarget(2, 'big')); // 450
  });
});

describe('slice5 progression — startBlind reads the curve (GDD §8.2)', () => {
  it('a fresh run opens on the Small blind at ante-1 target 100', () => {
    const run = newRun('curve');
    const blind = startBlind(run, makeRng('curve'));
    expect(blind.kind).toBe('small');
    expect(blind.target).toBe(100);
  });

  it('still honors an explicit target override', () => {
    const run = newRun('curve');
    expect(startBlind(run, makeRng('curve'), { target: 999 }).target).toBe(999);
  });
});

describe('slice5 progression — resolveBlind gold & advancement (GDD §9.1)', () => {
  it('clearing a Small blind pays reward + remaining phases + interest and advances to Big', () => {
    const run: RunState = { ...newRun('r'), gold: 10, ante: 1, blindIndex: 0 };
    const blind = blindWith({ kind: 'small', target: 100, phasesUsed: 2 }); // 2 phases left
    const out = resolveBlind(run, blind, 120);
    expect(out.cleared).toBe(true);
    // reward 3 + phases 2 + interest(10)=2 → 7 (no thrift voucher)
    expect(out.earned).toEqual({ reward: 3, phases: 2, interest: 2, thrift: 0, total: 7 });
    expect(out.run.gold).toBe(17);
    expect(out.run.blindIndex).toBe(1);
    expect(out.run.ante).toBe(1);
  });

  it('missing the target ends the run (game over, no gold, no advance)', () => {
    const run: RunState = { ...newRun('r'), gold: 10, ante: 1, blindIndex: 0 };
    const out = resolveBlind(run, blindWith({ target: 100 }), 50);
    expect(out.cleared).toBe(false);
    expect(out.gameOver).toBe(true);
    expect(out.run.gold).toBe(10);
    expect(out.run.blindIndex).toBe(0);
  });

  it('clearing the Boss rolls over to the next ante', () => {
    const run: RunState = { ...newRun('r'), gold: 25, ante: 1, blindIndex: 2 };
    const blind = blindWith({ kind: 'boss', target: 200, phasesUsed: 4 }); // 0 left
    const out = resolveBlind(run, blind, 200);
    // reward 5 + phases 0 + interest(25)=5 → 10
    expect(out.earned.total).toBe(10);
    expect(out.run.gold).toBe(35);
    expect(out.run.ante).toBe(2);
    expect(out.run.blindIndex).toBe(0);
  });

  it('runs a full ante Small→Big→Boss→ante 2', () => {
    let run = newRun('ante');
    for (const idx of [0, 1, 2]) {
      const kind = kindForIndex(idx as 0 | 1 | 2);
      const blind = blindWith({ kind, target: 1, phasesUsed: 4 });
      const out = resolveBlind(run, blind, 1000);
      expect(out.cleared).toBe(true);
      run = out.run;
    }
    expect(run.ante).toBe(2);
    expect(run.blindIndex).toBe(0);
  });
});
