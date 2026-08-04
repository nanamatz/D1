import { describe, expect, it } from 'vitest';
import {
  applyEdition,
  rollJokerEdition,
  rollShopTileEdition,
  rollTileEdition,
} from '../src/engine/editions';
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

  it('Flyer/Wanted Poster expose the strongest owned edition-rate tier', () => {
    expect(editionRateMultiplier(newRun('e'))).toBe(1);
    expect(editionRateMultiplier({ ...newRun('e'), vouchers: ['flyer'] })).toBe(2);
    expect(editionRateMultiplier({ ...newRun('e'), vouchers: ['flyer', 'wantedPoster'] })).toBe(4);
  });

  it('uses exact weighted edition bands and keeps White at its fixed rate', () => {
    const at = (value: number) => ({ next: () => value });
    const fresh = newRun('edition-rates');
    expect(rollJokerEdition(fresh, at(0.001))).toBe('gray');
    expect(rollJokerEdition(fresh, at(0.025))).toBe('violet');
    expect(rollJokerEdition(fresh, at(0.035))).toBe('rainbow');
    expect(rollJokerEdition(fresh, at(0.039))).toBe('white');
    expect(rollJokerEdition(fresh, at(0.041))).toBe('base');

    const flyer = { ...fresh, vouchers: ['flyer' as const] };
    expect(rollJokerEdition(flyer, at(0.078))).toBe('white');
    expect(rollTileEdition(flyer, at(0.10))).toBe('violet');
    expect(rollShopTileEdition(at(0.18))).toBe('rainbow');
    expect(rollShopTileEdition(at(0.21))).toBe('base');
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
