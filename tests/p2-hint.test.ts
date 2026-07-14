import { describe, it, expect } from 'vitest';
import { findSpellableWords } from '../src/engine/hint';
import { makeLexicon } from '../src/engine/lexicon';
import type { Letter, Tile } from '../src/engine/types';

let idc = 0;
const hand = (word: string): Tile[] =>
  [...word.toUpperCase()].map((c) => ({
    id: `h${idc++}`,
    letter: c as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

const lex = makeLexicon(['cat', 'cats', 'act', 'dog', 'eel', 'bee', 'be'], {
  cats: { suit: 'slang', pos: ['noun'] }, // slang ×2 → highest score
});

describe('P2-1 — per-hand word solver (Magnifier)', () => {
  it('finds words spellable from the hand, best-scoring first', () => {
    const found = findSpellableWords(hand('CATSO'), lex, 3);
    expect(found[0]!.word).toBe('cats'); // slang ×2 tops the list
    expect(found.map((f) => f.word)).toContain('act');
    expect(found.map((f) => f.word)).not.toContain('dog'); // no d/o... (o present but no d/g)
  });

  it('caps the result count', () => {
    expect(findSpellableWords(hand('CATS'), lex, 2).length).toBeLessThanOrEqual(2);
  });

  it('returns tile ids that actually spell each word', () => {
    const h = hand('CAT');
    const [first] = findSpellableWords(h, lex, 3);
    expect(first!.tileIds).toHaveLength(first!.word.length);
    // every id belongs to the hand, no id reused
    expect(new Set(first!.tileIds).size).toBe(first!.tileIds.length);
    for (const id of first!.tileIds) expect(h.some((t) => t.id === id)).toBe(true);
  });

  it('respects duplicate-letter supply', () => {
    // "eel" needs two E's; a single-E hand cannot spell it
    expect(findSpellableWords(hand('ELB'), lex, 3).map((f) => f.word)).not.toContain('eel');
    // two E's → "eel" and "bee" become available
    const two = findSpellableWords(hand('EELB'), lex, 5).map((f) => f.word);
    expect(two).toContain('eel');
    expect(two).toContain('bee');
  });

  it('returns nothing when no word is spellable', () => {
    expect(findSpellableWords(hand('XZ'), lex, 3)).toEqual([]);
  });
});
