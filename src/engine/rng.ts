/**
 * Seeded RNG (GDD engine principle 4). One PRNG feeds every random draw —
 * bag shuffle, shop stock, packs, boss selection — so a run is fully
 * reproducible from RunState.seed. The engine must NEVER call Math.random().
 *
 * mulberry32: a tiny, fast, well-distributed 32-bit PRNG. Seed strings are
 * folded to a uint32 with FNV-1a so any human/URL seed works.
 */

export interface Rng {
  /** next float in [0, 1) */
  next(): number;
  /** integer in [0, maxExclusive) */
  int(maxExclusive: number): number;
  /** returns a new array — a deterministic Fisher-Yates shuffle; input untouched */
  shuffle<T>(items: readonly T[]): T[];
}

/** Fold an arbitrary seed string to a uint32 via FNV-1a. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0;
}

export function makeRng(seed: string): Rng {
  let a = hashSeed(seed);

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const tmp = out[i]!;
      out[i] = out[j]!;
      out[j] = tmp;
    }
    return out;
  };

  return { next, int, shuffle };
}
