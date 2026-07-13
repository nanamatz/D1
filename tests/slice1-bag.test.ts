import { describe, it, expect } from 'vitest';
import { buildBag, drawTiles } from '../src/engine/bag';
import { makeRng } from '../src/engine/rng';
import { BALANCE } from '../src/engine/balance';
import type { Letter, Tile } from '../src/engine/types';

const countByLetter = (tiles: Tile[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const t of tiles) counts[t.letter] = (counts[t.letter] ?? 0) + 1;
  return counts;
};

describe('slice1 bag — build from BALANCE.bagComposition (GDD §2.1)', () => {
  it('builds exactly 98 tiles', () => {
    expect(buildBag().length).toBe(98);
  });

  it('matches the per-letter composition table', () => {
    const counts = countByLetter(buildBag());
    for (const [letter, n] of Object.entries(BALANCE.bagComposition)) {
      expect(counts[letter] ?? 0).toBe(n);
    }
  });

  it('gives every tile a unique id', () => {
    const bag = buildBag();
    const ids = new Set(bag.map((t) => t.id));
    expect(ids.size).toBe(bag.length);
  });

  it('starts tiles as unenhanced ceramic / medium base (GDD §2.2–2.3)', () => {
    const t = buildBag()[0]!;
    expect(t.material).toBe('ceramic');
    expect(t.font).toBe('medium');
  });
});

describe('slice1 bag — shuffle preserves the multiset', () => {
  it('is a permutation of the same tiles (no tiles gained or lost)', () => {
    const rng = makeRng('bag-shuffle');
    const shuffled = rng.shuffle(buildBag());
    expect(shuffled.length).toBe(98);
    expect(countByLetter(shuffled)).toEqual(countByLetter(buildBag()));
  });
});

describe('slice1 bag — draw (GDD §6.1, §6.6 no refill)', () => {
  it('draws n tiles and leaves the rest in the bag', () => {
    const bag = buildBag();
    const { drawn, bag: rest } = drawTiles(bag, 11);
    expect(drawn.length).toBe(11);
    expect(rest.length).toBe(98 - 11);
  });

  it('does not mutate the source bag array', () => {
    const bag = buildBag();
    const before = bag.length;
    drawTiles(bag, 11);
    expect(bag.length).toBe(before);
  });

  it('draws only what remains when the bag runs low — no refill (GDD §6.6)', () => {
    const bag = buildBag().slice(0, 3);
    const { drawn, bag: rest } = drawTiles(bag, 11);
    expect(drawn.length).toBe(3);
    expect(rest.length).toBe(0);
  });

  it('draws nothing from an empty bag', () => {
    const { drawn, bag: rest } = drawTiles([], 5);
    expect(drawn).toEqual([]);
    expect(rest).toEqual([]);
  });
});
