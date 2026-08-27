import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addOwnedJoker } from '../src/engine/jokers';
import { discardTiles, startBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Tile } from '../src/engine/types';
import { createGrowthPopQueue } from '../src/ui/growthPopQueue';
import { GROWTH_POP_MS } from '../src/ui/timing';

describe('Emoji Tile lifecycle popup FIFO', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('survives an ordinary prop update after the first of six pops', () => {
    let run = newRun('growth-pop-fifo');
    run = addOwnedJoker(addOwnedJoker(addOwnedJoker(
      run, 'discardedDraft'), 'recycling'), 'hollowPromise');
    run.jokers[1]!.state.letterCode = 'A'.charCodeAt(0);
    const hand: Tile[] = [0, 1].map((index) => ({
      id: `growth-pop-a-${index}`, letter: 'A', material: 'ceramic',
      font: 'inline', edition: 'base',
    }));
    const discarded = discardTiles(
      { ...startBlind(run, makeRng(run.seed)), hand }, run,
      hand.map((tile) => tile.id), makeRng('growth-pop-fifo-discard'),
    );
    const events = discarded.run.lifecycleGrowthEvents!.slice(-6);
    const shown: Array<[number | undefined, string]> = [];
    const mountedKeys: string[] = [];
    let mountedKey: string | null = null;
    const queue = createGrowthPopQueue<(typeof events)[number]>(
      (event) => {
        mountedKey = `${event.jokerInstanceId}:${event.sequence}`;
        mountedKeys.push(mountedKey);
        shown.push([event.jokerInstanceId, event.kind]);
      },
      () => { mountedKey = null; },
      GROWTH_POP_MS,
    );

    queue.enqueue(events);
    expect(shown).toEqual([[1, 'chips']]);

    // Submit starts: lifecycle pauses for the authoritative settleComplete=false span.
    queue.setPaused(true);
    expect(mountedKey).toBeNull();
    queue.enqueue([]);
    const settleShown = ['tile', 'joker', 'settle'];
    vi.advanceTimersByTime(GROWTH_POP_MS * 20);
    expect(settleShown).toEqual(['tile', 'joker', 'settle']);
    expect(shown).toEqual([[1, 'chips']]);

    // SettleProvider completion starts the next pending item; the consumed first pop never remounts.
    queue.setPaused(false);
    for (let index = 0; index < 5; index += 1) {
      vi.advanceTimersByTime(GROWTH_POP_MS);
    }
    expect(shown).toEqual([
      [1, 'chips'], [2, 'gold'], [3, 'gold'],
      [1, 'chips'], [2, 'gold'], [3, 'gold'],
    ]);
    vi.advanceTimersByTime(GROWTH_POP_MS * 2);
    expect(shown).toHaveLength(6);
    expect(mountedKeys).toEqual(events.map(
      (event) => `${event.jokerInstanceId}:${event.sequence}`,
    ));
    expect(new Set(mountedKeys).size).toBe(6);
  });

  it('appends new events behind the active queue and resets only explicitly', () => {
    const shown: string[] = [];
    const queue = createGrowthPopQueue<string>(
      (value) => shown.push(value),
      () => undefined,
      GROWTH_POP_MS,
    );
    queue.enqueue(['a', 'b']);
    queue.setPaused(true);
    queue.enqueue(['c']);
    vi.advanceTimersByTime(GROWTH_POP_MS * 10);
    expect(shown).toEqual(['a']);
    queue.setPaused(false);
    vi.advanceTimersByTime(GROWTH_POP_MS * 2);
    expect(shown).toEqual(['a', 'b', 'c']);
    queue.enqueue(['old']);
    queue.reset();
    vi.advanceTimersByTime(GROWTH_POP_MS);
    expect(shown).toEqual(['a', 'b', 'c', 'old']);

    queue.setPaused(true);
    queue.setPaused(true);
    queue.enqueue(['held-a', 'held-b']);
    vi.advanceTimersByTime(GROWTH_POP_MS * 3);
    expect(shown).toEqual(['a', 'b', 'c', 'old']);
    queue.setPaused(false);
    expect(shown).toEqual(['a', 'b', 'c', 'old', 'held-a']);
    vi.advanceTimersByTime(GROWTH_POP_MS);
    expect(shown).toEqual(['a', 'b', 'c', 'old', 'held-a', 'held-b']);
  });
});
