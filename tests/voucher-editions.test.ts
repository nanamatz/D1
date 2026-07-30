import { describe, expect, it } from 'vitest';
import { applyEdition } from '../src/engine/editions';
import { newRun } from '../src/engine/run';
import type { WordScoringContext, WordSubmission } from '../src/engine/types';
import { canAddJoker, editionRateMultiplier, jokerSlotLimit } from '../src/engine/vouchers';

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
  it('applies Gray, Violet, and Rainbow scoring', () => {
    const gray = ctx();
    applyEdition(gray, 'gray');
    expect(gray.chips).toBe(60);

    const violet = ctx();
    applyEdition(violet, 'violet');
    expect(violet.mult).toBe(12);

    const rainbow = ctx();
    applyEdition(rainbow, 'rainbow');
    expect(rainbow.mult).toBe(3);
  });

  it('Flyer/Wanted Poster use strongest-tier 2×/4× odds', () => {
    expect(editionRateMultiplier(newRun('e'))).toBe(1);
    expect(editionRateMultiplier({ ...newRun('e'), vouchers: ['flyer'] })).toBe(2);
    expect(editionRateMultiplier({ ...newRun('e'), vouchers: ['flyer', 'wantedPoster'] })).toBe(4);
  });

  it('a White Emoji Tile does not consume the base slot', () => {
    const run = {
      ...newRun('white-slot'),
      jokerSlots: 1,
      jokers: [{ defId: 'bookworm', edition: 'white' as const, state: {} }],
    };
    expect(jokerSlotLimit(run)).toBe(2);
    expect(canAddJoker(run, 'stargazer')).toBe(true);
  });
});
