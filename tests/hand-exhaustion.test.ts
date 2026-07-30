import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blindExhausted } from '../src/engine/loop';
import { resolveBlind } from '../src/engine/progression';
import { newRun } from '../src/engine/run';
import type { BlindState, Letter, Tile } from '../src/engine/types';

let idc = 0;
const tile = (letter: Letter): Tile => ({
  id: `e${idc++}`,
  letter,
  material: 'ceramic',
  font: 'medium',
});

/** A minimal blind shape for the predicate — only hand/bag are read. */
const blindWith = (hand: Tile[], bag: Tile[]): BlindState =>
  ({ hand, bag } as unknown as BlindState);

describe('blindExhausted — an unplayable board (GDD §6.3, §6.6)', () => {
  it('is true only when the hand AND the pouch are both empty', () => {
    expect(blindExhausted(blindWith([], []))).toBe(true);
  });

  it('is false while a tile remains in hand', () => {
    expect(blindExhausted(blindWith([tile('A')], []))).toBe(false);
  });

  it('is false while the pouch can still refill the hand', () => {
    expect(blindExhausted(blindWith([], [tile('A')]))).toBe(false);
  });
});

describe('an exhausted board below target ends the run (GDD §7.4 → §9.1)', () => {
  it('resolveBlind reports a loss when the finalized score misses the target', () => {
    const run = newRun('exhaustion');
    const blind = { ...blindWith([], []), target: 100 } as BlindState;
    const outcome = resolveBlind(run, blind, 40);
    expect(outcome.cleared).toBe(false);
    expect(outcome.gameOver).toBe(true);
  });
});

describe('useGame wires the predicate at BOTH call sites', () => {
  const game = readFileSync('src/ui/useGame.ts', 'utf8');

  it('imports the shared predicate rather than re-deriving the condition', () => {
    expect(game).toContain('blindExhausted');
    // The raw condition must not be hand-inlined anywhere — one predicate, two callers.
    expect(game).not.toContain('hand.length === 0 && ');
  });

  it('uses it in the play path alongside phasesOut / autoSettle', () => {
    expect(game).toMatch(/phasesOut \|\| dryOut \|\| autoSettle/);
  });

  it('uses it in the discard path — discarding the last tiles with a dry pouch', () => {
    // The discard reducer must set pendingEnd, not return a stuck board.
    const discard = game.slice(game.indexOf('const discard = useCallback'));
    expect(discard.slice(0, 2000)).toContain('blindExhausted');
  });
});
