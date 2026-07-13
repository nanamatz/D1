import { describe, it, expect } from 'vitest';
import { makeRng } from '../src/engine/rng';

describe('slice1 rng — seeded, reproducible (GDD §engine principle 4)', () => {
  it('produces an identical stream for the same seed', () => {
    const a = makeRng('run-seed-1');
    const b = makeRng('run-seed-1');
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces a different stream for a different seed', () => {
    const a = makeRng('seed-A');
    const b = makeRng('seed-B');
    expect(a.next()).not.toEqual(b.next());
  });

  it('emits floats in [0, 1)', () => {
    const rng = makeRng('range-check');
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int(n) returns integers in [0, n)', () => {
    const rng = makeRng('int-check');
    for (let i = 0; i < 1000; i++) {
      const x = rng.int(6);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(6);
    }
  });

  it('shuffle is a deterministic permutation for a given seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s1 = makeRng('shuf').shuffle(input);
    const s2 = makeRng('shuf').shuffle(input);
    expect(s1).toEqual(s2); // deterministic
    expect([...s1].sort((a, b) => a - b)).toEqual(input); // same multiset
    expect(s1).not.toEqual(input); // actually shuffled (this permutation moves things)
  });

  it('shuffle does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    makeRng('nomutate').shuffle(input);
    expect(input).toEqual(copy);
  });
});
