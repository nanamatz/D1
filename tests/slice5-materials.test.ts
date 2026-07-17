import { describe, it, expect } from 'vitest';
import { scoreWord, spell, letterChips, letterString, NO_LETTER } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { isVowel, isConsonant } from '../src/engine/types';
import type { Letter, Tile, TileMaterial } from '../src/engine/types';

let idc = 0;
/** Build tiles from a word; '_' means a letterless stone tile. */
const tiles = (word: string, material: TileMaterial = 'ceramic'): Tile[] =>
  [...word.toUpperCase()].map((ch) => ({
    id: `m${idc++}`,
    letter: ch === '_' ? null : (ch as Letter),
    case: 'upper' as const,
    material: ch === '_' ? ('stone' as TileMaterial) : material,
    font: 'medium' as const,
  }));

const lex = makeLexicon(['cat'], {});

describe('slice5 — letterless tiles (GDD §2.2 Stone)', () => {
  it('spells a stone tile as the sentinel, never a lexicon word', () => {
    expect(spell(tiles('_cat'))).toBe(`${NO_LETTER}CAT`);
  });

  it('a word containing stone is gibberish — no suit multiplier', () => {
    const s = scoreWord(tiles('_cat'), lex);
    expect(s.isGibberish).toBe(true);
    expect(s.suit).toBeNull();
    // C3 A1 T1 = 5 chips; the stone contributes 0 letter chips, × 1.0 gibberish
    expect(s.settledScore).toBe(5);
  });

  it('the same tiles without the stone spell a real word', () => {
    expect(scoreWord(tiles('cat'), lex).isGibberish).toBe(false);
  });

  it('a stone tile contributes 0 letter chips', () => {
    expect(letterChips(tiles('_'))).toBe(0);
  });

  it('a stone is neither vowel nor consonant', () => {
    expect(isVowel(null)).toBe(false);
    expect(isConsonant(null)).toBe(false);
    expect(isVowel('A')).toBe(true);
    expect(isConsonant('B')).toBe(true);
  });
});

describe('slice5 — letterString (review finding 1)', () => {
  it('renders a letterless stone tile as the sentinel, not as a dropped/empty char', () => {
    const hand = tiles('_cat');
    const result = letterString(hand);
    expect(result).toBe(`${NO_LETTER}CAT`);
    // The regression this guards against: Array#join coerces `null` to `''`,
    // silently shortening the string instead of preserving the stone's slot.
    expect(result).not.toBe('CAT');
    expect(result).toHaveLength(4);
  });
});
