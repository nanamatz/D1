import { describe, it, expect } from 'vitest';
import { inkClass, faceClass } from '../src/ui/game';
import type { Letter, Tile } from '../src/engine/types';

const tile = (letter: Letter): Tile => ({
  id: 'x',
  letter,
  case: 'upper',
  material: 'ceramic',
  font: 'medium',
});

describe('P2-3 — tile ink tiers by chip value', () => {
  it('1 pt uses default ink (no tier class)', () => {
    expect(inkClass(1)).toBe('');
  });
  it('2–3 pt → ink-mid', () => {
    expect(inkClass(2)).toBe('ink-mid');
    expect(inkClass(3)).toBe('ink-mid');
  });
  it('4–5 pt → ink-hi', () => {
    expect(inkClass(4)).toBe('ink-hi');
    expect(inkClass(5)).toBe('ink-hi');
  });
  it('8–10 pt → ink-gild', () => {
    expect(inkClass(8)).toBe('ink-gild');
    expect(inkClass(10)).toBe('ink-gild');
  });
});

describe('P2-3 — vowel/consonant face tint (Y is a consonant)', () => {
  it('vowels', () => {
    expect(faceClass(tile('A'))).toBe('vowel');
    expect(faceClass(tile('E'))).toBe('vowel');
  });
  it('consonants incl. Y', () => {
    expect(faceClass(tile('B'))).toBe('cons');
    expect(faceClass(tile('Y'))).toBe('cons');
  });
});
