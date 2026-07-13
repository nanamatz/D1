import { describe, it, expect } from 'vitest';
import { scoreWord } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import type { Letter, Tile } from '../src/engine/types';

let idc = 0;
const tile = (letter: Letter, c: 'upper' | 'lower' = 'upper'): Tile => ({
  id: `x${idc++}`,
  letter,
  case: c,
  material: 'ceramic',
  font: 'medium',
});
const tiles = (word: string): Tile[] =>
  [...word.toUpperCase()].map((ch) => tile(ch as Letter));

const lex = makeLexicon(['cat', 'run'], {
  run: { suit: 'slang', pos: ['verbIntransitive'] },
});

describe('slice1 scoring — letter chips (GDD §2.1, §7.1 layer 1)', () => {
  it('sums Scrabble letter chips for a valid word', () => {
    // CAT = C(3)+A(1)+T(1) = 5
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(5);
  });

  it('marks a valid word as non-gibberish and carries its register suit', () => {
    const s = scoreWord(tiles('run'), lex);
    expect(s.isGibberish).toBe(false);
    expect(s.suit).toBe('slang');
  });

  it('applies the register suit multiplier in layer 1 (slice ②, GDD §3.1)', () => {
    // RUN = R(1)+U(1)+N(1) = 3 chips; slang ×2.0 = 6
    expect(scoreWord(tiles('run'), lex).settledScore).toBe(6);
  });

  it('leaves POS unresolved in slice ① (resolved by pattern matching, slice ③)', () => {
    expect(scoreWord(tiles('run'), lex).posUsed).toBeNull();
  });

  it('preserves the spelled text with original tile casing', () => {
    const s = scoreWord([tile('C', 'lower'), tile('A', 'lower'), tile('T', 'lower')], lex);
    expect(s.text).toBe('cat');
  });
});

describe('slice1 scoring — gibberish path (GDD §6.4)', () => {
  it('scores an invalid word as chips × 1.0 with no suit and a hole', () => {
    // ZZZ = 10+10+10 = 30, ×1.0
    const s = scoreWord(tiles('zzz'), lex);
    expect(s.isGibberish).toBe(true);
    expect(s.settledScore).toBe(30);
    expect(s.suit).toBeNull();
    expect(s.posUsed).toBeNull();
  });

  it('recovers intrinsic tile value even for nonsense (chips are intrinsic)', () => {
    // QI is not in our stub lexicon → gibberish. Q(10)+I(1) = 11
    expect(scoreWord(tiles('qi'), lex).settledScore).toBe(11);
  });
});
