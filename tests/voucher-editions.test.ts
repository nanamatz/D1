import { describe, expect, it } from 'vitest';
import { applyEdition } from '../src/engine/editions';
import { newRun } from '../src/engine/run';
import type { WordScoringContext, WordSubmission } from '../src/engine/types';
import { editionRateMultiplier } from '../src/engine/vouchers';

const submission: WordSubmission = {
  tiles: [],
  text: 'A',
  isGibberish: false,
  suit: 'standard',
  posUsed: 'noun',
  settledScore: 0,
};

const ctx = (): WordScoringContext => ({ submission, chips: 10, mult: 2 });

describe('tile and Charm editions', () => {
  it('applies Foil, Holographic, and Polychrome scoring', () => {
    const foil = ctx();
    applyEdition(foil, 'foil');
    expect(foil.chips).toBe(60);

    const holo = ctx();
    applyEdition(holo, 'holographic');
    expect(holo.mult).toBe(12);

    const poly = ctx();
    applyEdition(poly, 'polychrome');
    expect(poly.mult).toBe(3);
  });

  it('Flyer/Wanted Poster use strongest-tier 2×/4× odds', () => {
    expect(editionRateMultiplier(newRun('e'))).toBe(1);
    expect(editionRateMultiplier({ ...newRun('e'), vouchers: ['flyer'] })).toBe(2);
    expect(editionRateMultiplier({ ...newRun('e'), vouchers: ['flyer', 'wantedPoster'] })).toBe(4);
  });
});
