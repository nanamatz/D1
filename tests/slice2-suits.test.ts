import { describe, it, expect } from 'vitest';
import { scoreWord } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import type { Letter, Tile } from '../src/engine/types';

let idc = 0;
const tiles = (word: string): Tile[] =>
  [...word.toUpperCase()].map((ch) => ({
    id: `s${idc++}`,
    letter: ch as Letter,
    case: 'upper',
    material: 'ceramic',
    font: 'medium',
  }));

const lex = makeLexicon(['cat'], {
  run: { suit: 'slang', pos: ['verbIntransitive'] },
  gentleman: { suit: 'formal', pos: ['noun'] },
  damn: { suit: 'vulgar', pos: ['interjection'] },
});

describe('slice2 — suit multiplier in layer 1 (GDD §3.1, §7.1)', () => {
  it('standard ×1.0 leaves chips unchanged', () => {
    // CAT = 5 chips, standard ×1.0
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(5);
  });

  it('slang ×2.0', () => {
    // RUN = 3 chips × 2.0 = 6
    expect(scoreWord(tiles('run'), lex).settledScore).toBe(6);
  });

  it('formal ×1.5', () => {
    // GENTLEMAN = G2 E1 N1 T1 L1 E1 M3 A1 N1 = 12 chips × 1.5 = 18
    expect(scoreWord(tiles('gentleman'), lex).settledScore).toBe(18);
  });

  it('vulgar ×3.0', () => {
    // DAMN = D2 A1 M3 N1 = 7 chips × 3.0 = 21
    expect(scoreWord(tiles('damn'), lex).settledScore).toBe(21);
  });

  it('uses the exact BALANCE.suitMult knobs (no hard-coded multipliers)', () => {
    const run = scoreWord(tiles('run'), lex);
    expect(run.settledScore).toBe(3 * BALANCE.suitMult.slang);
  });

  it('gibberish bypasses the suit multiplier — chips ×1.0 only (GDD §6.4)', () => {
    // ZZZ = 30 chips, no suit → still 30 even though slang/vulgar exist
    const g = scoreWord(tiles('zzz'), lex);
    expect(g.isGibberish).toBe(true);
    expect(g.suit).toBeNull();
    expect(g.settledScore).toBe(30);
  });
});
