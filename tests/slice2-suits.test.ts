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
    // CAT = 15 chips, standard ×1.0 + length 3 => 15 × 4.0 = 60
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(60);
  });

  it('slang ×5', () => {
    // RUN = 9 chips, slang ×5 + length 3 => 9 × 8 = 72
    expect(scoreWord(tiles('run'), lex).settledScore).toBe(72);
  });

  it('formal ×3', () => {
    // GENTLEMAN = G6 E3 N3 T3 L3 E3 M9 A3 N3 = 36 chips; length 9;
    // formal ×3 + 9 = 12 => 36 × 12 = 432
    expect(scoreWord(tiles('gentleman'), lex).settledScore).toBe(432);
  });

  it('vulgar ×10', () => {
    // DAMN = D6 A3 M9 N3 = 21 chips; length 4; vulgar ×10 + 4 = 14 => 21 × 14 = 294
    expect(scoreWord(tiles('damn'), lex).settledScore).toBe(294);
  });

  it('uses the exact BALANCE.suitMult knobs (no hard-coded multipliers)', () => {
    const run = scoreWord(tiles('run'), lex);
    // 9 chips × (slang mult + length 3)
    expect(run.settledScore).toBe(9 * (BALANCE.suitMult.slang + 3));
  });

  it('gibberish bypasses the suit multiplier — chips ×1.0 only (GDD §6.4)', () => {
    // ZZZ = 90 chips, no suit → still 90 even though slang/vulgar exist
    const g = scoreWord(tiles('zzz'), lex);
    expect(g.isGibberish).toBe(true);
    expect(g.suit).toBeNull();
    expect(g.settledScore).toBe(90);
  });
});
