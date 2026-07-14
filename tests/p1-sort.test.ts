import { describe, it, expect } from 'vitest';
import { reorderIds, sortHand } from '../src/ui/game';
import type { Letter, Tile } from '../src/engine/types';

let idc = 0;
const t = (letter: Letter): Tile => ({
  id: `s${idc++}`,
  letter,
  case: 'upper',
  material: 'ceramic',
  font: 'medium',
});
const letters = (tiles: Tile[]) => tiles.map((x) => x.letter).join('');

describe('P1-1 — hand sort modes', () => {
  it('alphabetical', () => {
    expect(letters(sortHand([t('C'), t('A'), t('T')], 'alpha'))).toBe('ACT');
  });

  it('by chip value, descending (Q10 > D2 > A1)', () => {
    expect(letters(sortHand([t('A'), t('Q'), t('D')], 'value'))).toBe('QDA');
  });

  it('vowels first, then consonants, alpha within each group (Y is a consonant)', () => {
    expect(letters(sortHand([t('B'), t('A'), t('Y'), t('E')], 'vowel'))).toBe('AEBY');
  });

  it('is stable for equal keys (does not mutate input)', () => {
    const input = [t('A'), t('A'), t('E')];
    const ids = input.map((x) => x.id);
    const sorted = sortHand(input, 'alpha');
    expect(input.map((x) => x.id)).toEqual(ids); // input untouched
    // the two A's keep their original relative order
    expect(sorted.filter((x) => x.letter === 'A').map((x) => x.id)).toEqual([ids[0], ids[1]]);
  });

  it("'manual' preserves order (drag order)", () => {
    const input = [t('C'), t('A'), t('T')];
    expect(letters(sortHand(input, 'manual'))).toBe('CAT');
  });
});

describe('P1-2 — reorderIds (drag-reorder)', () => {
  it('moves an id to the target position', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves backward too', () => {
    expect(reorderIds(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op for unknown or identical ids (returns a copy)', () => {
    expect(reorderIds(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
    expect(reorderIds(['a', 'b'], 'z', 'b')).toEqual(['a', 'b']);
  });
});
