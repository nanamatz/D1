import { describe, it, expect } from 'vitest';
import { PACK_ART, packArt } from '../src/ui/packArt';
import { BALANCE } from '../src/engine/balance';
import type { PackSize } from '../src/engine/types';

const SIZES: PackSize[] = ['normal', 'jumbo', 'mega'];

describe('packArt — size → art mapping', () => {
  it('the art count per size matches BALANCE.pack.artVariants (engine picks rng.int of it)', () => {
    for (const size of SIZES) {
      expect(PACK_ART[size].length).toBe(BALANCE.pack.artVariants[size]);
    }
  });

  it('returns a defined url for every size and valid variant index', () => {
    for (const size of SIZES) {
      for (let v = 0; v < BALANCE.pack.artVariants[size]; v++) {
        expect(packArt(size, v)).toBe(PACK_ART[size][v]);
      }
    }
  });

  it('wraps an out-of-range variant instead of returning undefined', () => {
    for (const size of SIZES) {
      const n = PACK_ART[size].length;
      expect(packArt(size, n)).toBe(PACK_ART[size][0]); // wraps to first
      expect(packArt(size, -1)).toBe(PACK_ART[size][n - 1]); // negative wraps to last
    }
  });
});
