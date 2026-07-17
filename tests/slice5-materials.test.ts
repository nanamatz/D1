import { describe, it, expect } from 'vitest';
import { scoreWord, spell, letterChips, letterString, NO_LETTER } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { isVowel, isConsonant } from '../src/engine/types';
import type { Letter, Tile, TileMaterial } from '../src/engine/types';
import { makeRng } from '../src/engine/rng';
import { startBlind, submitWord } from '../src/engine/loop';
import { newRun } from '../src/engine/run';

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
    // C3 A1 T1 = 5 chips; the stone contributes 0 letter chips but +50 material
    // chips (GDD §2.2, wired in slice5-materials), × 1.0 gibberish
    expect(s.settledScore).toBe(55);
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

describe('slice5 — static per-tile material effects (GDD §2.2)', () => {
  it('porcelain adds +30 chips per tile', () => {
    // CAT = 5 chips; one porcelain C = +30 → 35 × 1.0 standard
    const t = tiles('cat');
    t[0]!.material = 'porcelain';
    expect(scoreWord(t, lex).settledScore).toBe(35);
  });

  it('porcelain stacks per tile', () => {
    const t = tiles('cat');
    t[0]!.material = 'porcelain';
    t[1]!.material = 'porcelain';
    expect(scoreWord(t, lex).settledScore).toBe(65); // 5 + 60
  });

  it('polished adds +4 mult per tile', () => {
    // CAT = 5 chips, standard mult 1.0 + 4 = 5.0 → 25
    const t = tiles('cat');
    t[0]!.material = 'polished';
    expect(scoreWord(t, lex).settledScore).toBe(25);
  });

  it('stone adds +50 chips and forces gibberish', () => {
    // '_' builds a stone tile: 0 letter chips + 50 material = 50 × 1.0 gibberish
    expect(scoreWord(tiles('_'), lex).settledScore).toBe(50);
  });

  it('ceramic changes nothing', () => {
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(5);
  });
});

describe('slice5 — Lead plate (GDD §2.2, Balatro Lucky)', () => {
  it('is reproducible: the same seed gives the same outcome', () => {
    const build = () => {
      const run = { ...newRun('mat-seed'), bag: tiles('cat', 'leadPlate') };
      const blind = startBlind(run, makeRng('mat-seed'));
      const ids = blind.hand.map((t) => t.id);
      return submitWord(blind, run, lex, ids, makeRng('roll-1'));
    };
    expect(build().submission.settledScore).toBe(build().submission.settledScore);
    expect(build().goldDelta).toBe(build().goldDelta);
  });

  it('different seeds eventually produce a mult hit (1/5) across many rolls', () => {
    const run = { ...newRun('mat-seed'), bag: tiles('cat', 'leadPlate') };
    let hits = 0;
    for (let i = 0; i < 200; i++) {
      const blind = startBlind(run, makeRng(`b${i}`));
      const ids = blind.hand.map((t) => t.id);
      const { events } = submitWord(blind, run, lex, ids, makeRng(`roll-${i}`));
      if (events.some((e) => e.kind === 'material' && e.multDelta > 0)) hits++;
    }
    // 3 lead tiles × 200 words at 1/5 each — a total miss would mean the RNG is not wired
    expect(hits).toBeGreaterThan(0);
  });

  it('two different explicit RNGs on the same run/blind/hand diverge (regression: rng must be threaded, not reseeded from run.seed)', () => {
    // Same run, same blind, same tile ids — only the RNG passed to submitWord differs.
    // If scoreSubmission silently reseeds from the constant run.seed instead of using
    // the passed rng, these two calls would be indistinguishable and this test would
    // fail to catch it (unlike the reproducibility tests above, which use the SAME
    // rng seed both times and so pass under either implementation).
    const run = { ...newRun('mat-seed'), bag: tiles('cat', 'leadPlate') };
    const blind = startBlind(run, makeRng('mat-seed'));
    const ids = blind.hand.map((t) => t.id);

    const a = submitWord(blind, run, lex, ids, makeRng('a'));
    const b = submitWord(blind, run, lex, ids, makeRng('b'));

    const multDelta = (r: ReturnType<typeof submitWord>) =>
      r.events
        .filter((e): e is Extract<typeof e, { kind: 'material' }> => e.kind === 'material')
        .reduce((sum, e) => sum + e.multDelta, 0);

    // Verified against the actual mulberry32 sequence: seed 'a' misses all 3 Lead
    // plate mult rolls (0 hits), seed 'b' hits 2 of 3 (+40 mult) — a genuinely
    // divergent pair, not a coincidence of the assertion shape.
    expect(multDelta(a)).toBe(0);
    expect(multDelta(b)).toBe(40);
    expect(multDelta(a)).not.toBe(multDelta(b));
    expect(a.submission.settledScore).not.toBe(b.submission.settledScore);
  });
});

describe('slice5 — Glass (GDD §2.2, the one gamble)', () => {
  it('doubles the mult on the word it is played in', () => {
    // CAT = 5 chips × (1.0 standard × 2) = 10
    const t = tiles('cat');
    t[0]!.material = 'glass';
    expect(scoreWord(t, lex).settledScore).toBe(10);
  });

  it('two glass tiles compound the factor', () => {
    const t = tiles('cat');
    t[0]!.material = 'glass';
    t[1]!.material = 'glass';
    expect(scoreWord(t, lex).settledScore).toBe(20); // 5 × 1.0 × 2 × 2
  });

  it('reports destroyed tiles and is seed-reproducible', () => {
    const run = { ...newRun('glass-seed'), bag: tiles('cat', 'glass') };
    const roll = () => {
      const blind = startBlind(run, makeRng('glass-seed'));
      const ids = blind.hand.map((t) => t.id);
      return submitWord(blind, run, lex, ids, makeRng('shatter')).destroyedTileIds;
    };
    expect(roll()).toEqual(roll());
  });

  it('destroys roughly 1/4 of glass tiles played', () => {
    const run = { ...newRun('glass-seed'), bag: tiles('cat', 'glass') };
    let destroyed = 0;
    const TRIALS = 400;
    for (let i = 0; i < TRIALS; i++) {
      const blind = startBlind(run, makeRng(`g${i}`));
      const ids = blind.hand.map((t) => t.id);
      destroyed += submitWord(blind, run, lex, ids, makeRng(`s${i}`)).destroyedTileIds.length;
    }
    const rate = destroyed / (TRIALS * 3); // 3 glass tiles per word
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.35);
  });

  it('two different explicit RNGs on the same run/blind/hand diverge on destroyedTileIds (regression: destroy roll must consume the passed rng)', () => {
    const run = { ...newRun('glass-seed'), bag: tiles('cat', 'glass') };
    const blind = startBlind(run, makeRng('glass-seed'));
    const ids = blind.hand.map((t) => t.id);

    const a = submitWord(blind, run, lex, ids, makeRng('shatter-a'));
    const b = submitWord(blind, run, lex, ids, makeRng('shatter-b'));

    // Verified against the actual mulberry32 sequence for this hand: both seeds
    // destroy exactly one of the 3 glass tiles, but a DIFFERENT one each time
    // ('shatter-a' → the 2nd tile, 'shatter-b' → the 1st) — a genuinely
    // divergent pair, not a coincidence of the assertion shape.
    expect(a.destroyedTileIds.length).toBe(1);
    expect(b.destroyedTileIds.length).toBe(1);
    expect(a.destroyedTileIds).not.toEqual(b.destroyedTileIds);
  });
});
