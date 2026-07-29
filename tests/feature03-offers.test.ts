/**
 * feature-03 C-1/C-2 — the shared Emoji-Tile offer pool: rarity weights, no
 * duplicates, Legendary excluded, selling returns a tile to the pool.
 */
import { describe, it, expect } from 'vitest';
import { availableJokerDefs, jokerRarityWeight, sampleJokerDefs } from '../src/engine/offers';
import { ALL_JOKERS } from '../src/engine/jokers';
import type { JokerDef } from '../src/engine/events';
import { BALANCE } from '../src/engine/balance';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { RunState } from '../src/engine/types';

const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun('offers'), ...over });

describe('feature-03 C-1 — rarity weights (GDD §9.2)', () => {
  it('reads Common 70 / Uncommon 25 / Rare 5 from BALANCE, Legendary weight 0', () => {
    expect(BALANCE.emoji.rarityWeights).toMatchObject({ common: 70, uncommon: 25, rare: 5 });
    const fakeLegendary = { id: 'x', rarity: 'legendary' } as unknown as JokerDef;
    expect(jokerRarityWeight(fakeLegendary)).toBe(0);
  });

  it('Legendary never appears in the offer pool (excluded, §12 open route)', () => {
    // No Legendary joker exists yet, but the filter must be by weight, not by luck.
    for (const def of availableJokerDefs(run())) {
      expect(jokerRarityWeight(def)).toBeGreaterThan(0);
    }
  });

  it('offers Common/Uncommon/Rare from the full roster and never a Legendary', () => {
    const offered = sampleJokerDefs(run(), 20, makeRng('review-pool'));
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((def) => def.rarity !== 'legendary')).toBe(true);
    // 70/25/5 weights: a 20-draw sample must reach past the Rare-only roster.
    expect(offered.some((def) => def.rarity === 'common')).toBe(true);
  });
});

describe('feature-03 C-2 — no duplicate Emoji Tiles (single shared filter)', () => {
  it('excludes jokers the run already owns', () => {
    const owned = ALL_JOKERS[0]!;
    const r = run({ jokers: [{ defId: owned.id, edition: 'base', state: {} }] });
    expect(availableJokerDefs(r).some((j) => j.id === owned.id)).toBe(false);
  });

  it('a single roll never offers the same tile twice', () => {
    const ids = sampleJokerDefs(run(), 10, makeRng('dup')).map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns fewer than asked once the pool is exhausted (shrinking pool → "nothing new")', () => {
    const allOwned = run({ jokers: ALL_JOKERS.map((j) => ({ defId: j.id, edition: 'base' as const, state: {} })) });
    expect(sampleJokerDefs(allOwned, 5, makeRng('empty'))).toHaveLength(0);
    expect(availableJokerDefs(allOwned)).toHaveLength(0);
  });

  it('selling a tile returns it to the pool (it just leaves run.jokers)', () => {
    const j = ALL_JOKERS[0]!;
    const withIt = run({ jokers: [{ defId: j.id, edition: 'base', state: {} }] });
    expect(availableJokerDefs(withIt).some((d) => d.id === j.id)).toBe(false);
    const afterSell = run({ jokers: [] });
    expect(availableJokerDefs(afterSell).some((d) => d.id === j.id)).toBe(true);
  });
});
