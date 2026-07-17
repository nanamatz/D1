import { describe, it, expect } from 'vitest';
import { scoreWord, spell, letterChips, NO_LETTER } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { isVowel, isConsonant } from '../src/engine/types';
import { stagePreview } from '../src/ui/game';
import type { Letter, Tile, TileMaterial, BlindState } from '../src/engine/types';

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

/** Minimal BlindState fixture for stagePreview tests below. */
function makeBlind(hand: Tile[]): BlindState {
  return {
    kind: 'small',
    bossId: null,
    target: 100,
    phasesTotal: 4,
    phasesUsed: 0,
    discardsLeft: 3,
    committedScore: 0,
    projectedScore: 0,
    sequence: [],
    bag: [],
    hand,
    discardedThisBlind: [],
  };
}

describe('slice5 — stagePreview does not silently drop stone tiles (review finding 1)', () => {
  it('previews a stone-containing selection as gibberish, spelled with the sentinel', () => {
    const hand = tiles('_cat');
    const preview = stagePreview(makeBlind(hand), lex, hand.map((t) => t.id));
    expect(preview).not.toBeNull();
    expect(preview!.isGibberish).toBe(true);
    // base.text goes through spell() already; this asserts the preview pipeline
    // (including the letters string built for evaluateLetterHand) runs clean
    // on a null-letter tile instead of throwing or silently coercing it away.
    expect(preview!.text).toBe(`${NO_LETTER}CAT`);
    expect(preview!.suit).toBeNull();
  });

  it('a straight letter hand still evaluates correctly around a stone tile', () => {
    // Q R S T U V is a 6-run straight; inserting a stone tile must not break
    // detection (the letters string is `${NO_LETTER}QRSTUV`, not `QRSTUV` vs
    // silently-shortened `QRSTUV` either way — this pins current behavior so
    // a future regression in the join logic is caught).
    const hand = tiles('_qrstuv');
    const preview = stagePreview(makeBlind(hand), lex, hand.map((t) => t.id));
    expect(preview).not.toBeNull();
    expect(preview!.isGibberish).toBe(true);
    expect(preview!.letterHand?.id).toBe('straight');
  });
});
