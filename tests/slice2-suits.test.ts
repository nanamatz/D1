import { describe, it, expect } from 'vitest';
import { scoreWord } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import { findSpellableWords } from '../src/engine/hint';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
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
  sir: { suit: 'formal', pos: ['noun'] },
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

  it('formal ×10', () => {
    // GENTLEMAN = G6 E3 N3 T3 L3 E3 M9 A3 N3 = 36 chips; length 9;
    // formal ×10 + 9 = 19 => 36 × 19 = 684
    expect(scoreWord(tiles('gentleman'), lex).settledScore).toBe(684);
  });

  it('vulgar ×7', () => {
    // DAMN = D6 A3 M9 N3 = 21 chips; length 4; vulgar ×7 + 4 = 11 => 21 × 11 = 231
    expect(scoreWord(tiles('damn'), lex).settledScore).toBe(231);
  });

  it('uses the exact BALANCE.suitMult knobs (no hard-coded multipliers)', () => {
    const run = scoreWord(tiles('run'), lex);
    // 9 chips × (slang mult + length 3)
    expect(run.settledScore).toBe(9 * (BALANCE.suitMult.slang + 3));
  });

  it('keeps formal above vulgar, slang, and standard', () => {
    expect(BALANCE.suitMult.formal).toBeGreaterThan(BALANCE.suitMult.vulgar);
    expect(BALANCE.suitMult.vulgar).toBeGreaterThan(BALANCE.suitMult.slang);
    expect(BALANCE.suitMult.slang).toBeGreaterThan(BALANCE.suitMult.standard);
  });

  it('keeps Formal and Vulgar scores identical in reference, live, and hint paths', () => {
    for (const word of ['sir', 'damn']) {
      const played = tiles(word);
      const reference = scoreWord(played, lex).settledScore;
      const run = newRun(`register-path-${word}`);
      const blind = { ...startBlind(run, makeRng(`register-path-${word}`)), hand: played };
      const live = submitWord(
        blind,
        run,
        lex,
        played.map((tile) => tile.id),
        makeRng(`register-path-${word}-play`),
      ).submission.settledScore;
      const hint = findSpellableWords(played, lex, 10).find((entry) => entry.word === word);

      expect(live).toBe(reference);
      expect(hint?.score).toBe(reference);
    }
  });

  it('gibberish bypasses the suit multiplier — chips ×1.0 only (GDD §6.4)', () => {
    // ZZZ = 90 chips, no suit → still 90 even though slang/vulgar exist
    const g = scoreWord(tiles('zzz'), lex);
    expect(g.isGibberish).toBe(true);
    expect(g.suit).toBeNull();
    expect(g.settledScore).toBe(90);
  });
});
