import { describe, it, expect } from 'vitest';
import { scoreWord, spell, letterChips, letterString, NO_LETTER } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { isVowel, isConsonant } from '../src/engine/types';
import type { Letter, Tile, TileMaterial } from '../src/engine/types';
import { makeRng, type Rng } from '../src/engine/rng';
import { startBlind, submitWord, endBlind } from '../src/engine/loop';
import { newRun } from '../src/engine/run';
import { BALANCE } from '../src/engine/balance';

let idc = 0;
/** Build tiles from a word; '_' means a letterless stone tile. */
const tiles = (word: string, material: TileMaterial = 'ceramic'): Tile[] =>
  [...word.toUpperCase()].map((ch) => ({
    id: `m${idc++}`,
    letter: ch === '_' ? null : (ch as Letter),
    material: ch === '_' ? ('stone' as TileMaterial) : material,
    font: 'medium' as const,
  }));

const lex = makeLexicon(['cat'], {});
const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: (max) => Math.min(max - 1, Math.floor(value * max)),
  shuffle: <T>(items: readonly T[]) => [...items],
});

describe('slice5 — letterless tiles (GDD §2.2 Stone)', () => {
  it('spells a stone tile as the sentinel, never a lexicon word', () => {
    expect(spell(tiles('_cat'))).toBe(`${NO_LETTER}CAT`);
  });

  it('a word containing stone is gibberish — no suit multiplier', () => {
    const s = scoreWord(tiles('_cat'), lex);
    expect(s.isGibberish).toBe(true);
    expect(s.suit).toBeNull();
    // C9 A3 T3 = 15 chips; the stone contributes 0 letter chips but +50 material
    // chips (GDD §2.2, wired in slice5-materials), × 1.0 gibberish
    expect(s.settledScore).toBe(65);
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
    // scoreWord runs materials BEFORE length (matches loop.ts::scoreSubmission).
    // Porcelain is additive-only on chips, so order vs. length doesn't change the
    // result: mult = suit 1.0 + length 3 = 4.0 either way.
    // CAT = 15 chips; one porcelain C = +30 → 45 chips × 4.0 = 180
    const t = tiles('cat');
    t[0]!.material = 'porcelain';
    expect(scoreWord(t, lex).settledScore).toBe(180);
  });

  it('porcelain stacks per tile', () => {
    const t = tiles('cat');
    t[0]!.material = 'porcelain';
    t[1]!.material = 'porcelain';
    // chips = 15 + 30 + 30 = 75; mult = 1.0 + 3 = 4.0 => 75 × 4.0 = 300
    expect(scoreWord(t, lex).settledScore).toBe(300);
  });

  it('polished adds +4 mult per tile', () => {
    // Polished is additive on mult too, so materials-before-length vs.
    // length-before-materials gives the same sum: mult = 1.0 + 4 + 3 = 8.0
    // (only a MULTIPLICATIVE material like Glass is order-sensitive).
    // CAT = 15 chips → 15 × 8.0 = 120
    const t = tiles('cat');
    t[0]!.material = 'polished';
    expect(scoreWord(t, lex).settledScore).toBe(120);
  });

  it('stone adds +50 chips and forces gibberish', () => {
    // '_' builds a stone tile: 0 letter chips + 50 material = 50 × 1.0 gibberish
    // (gibberish excludes the length mult — unchanged)
    expect(scoreWord(tiles('_'), lex).settledScore).toBe(50);
  });

  it('ceramic changes nothing', () => {
    // CAT = 15 chips; standard ×1.0 + length 3 => 15 × 4.0 = 60
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(60);
  });
});

describe('slice5 — Lead plate (GDD §2.2, Balatro Lucky)', () => {
  it('uses independent 1-in-5 rolls for +20 Mult and +$20', () => {
    expect(BALANCE.materials.leadPlate).toEqual({
      multChance: 0.2,
      mult: 20,
      goldChance: 0.2,
      gold: 20,
    });
  });

  it('records both independent rolls even when they fail', () => {
    const run = newRun('lead-chance-fx');
    const hand = tiles('a', 'leadPlate');
    const play = (value: number) => submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      makeLexicon(['a'], {}),
      [hand[0]!.id],
      fixedRng(value),
    ).events.find((event) => event.kind === 'material');
    expect(play(0)?.chanceResults?.map((result) => result.outcome)).toEqual(['success', 'success']);
    expect(play(0.99)?.chanceResults?.map((result) => result.outcome)).toEqual(['failure', 'failure']);
  });

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
  it('reports its tooltip factor for multiplicative settle presentation', () => {
    const run = newRun('glass-factor');
    const hand = tiles('cat');
    hand[0]!.material = 'glass';
    const { events } = submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      lex,
      hand.map((tile) => tile.id),
      makeRng('glass-factor-score'),
    );
    const glassBeat = events.find(
      (e): e is Extract<typeof e, { kind: 'material' }> =>
        e.kind === 'material' && e.material === 'glass',
    );
    expect(glassBeat?.multFactor).toBe(BALANCE.materials.glass.multFactor);
  });

  it('records actual survival or destruction, including insurance prevention', () => {
    const hand = tiles('cat');
    hand[0]!.material = 'glass';
    const play = (run: ReturnType<typeof newRun>, value: number) => submitWord(
      { ...startBlind(run, makeRng(run.seed)), hand },
      run,
      lex,
      hand.map((tile) => tile.id),
      fixedRng(value),
    );
    const outcome = (result: ReturnType<typeof submitWord>) => result.events.find(
      (event): event is Extract<typeof event, { kind: 'material' }> =>
        event.kind === 'material' && event.tileId === hand[0]!.id,
    )?.chanceResults?.[0]?.outcome;

    const destroyed = play(newRun('glass-destroy-fx'), 0);
    expect(destroyed.destroyedTileIds).toContain(hand[0]!.id);
    expect(destroyed.submission.destroyedTileIds).toContain(hand[0]!.id);
    expect(outcome(destroyed)).toBe('destroyed');

    expect(outcome(play(newRun('glass-survive-fx'), 0.99))).toBe('survived');

    const insuredRun = newRun('glass-insured-fx');
    insuredRun.jokers = [{ defId: 'glassInsurance', state: {} }];
    const insured = play(insuredRun, 0);
    expect(insured.destroyedTileIds).not.toContain(hand[0]!.id);
    expect(insured.submission.destroyedTileIds).toBeUndefined();
    expect(outcome(insured)).toBe('survived');

    const termInsuredRun = newRun('term-insured-fx');
    termInsuredRun.jokers = [{ defId: 'termInsurance', state: {} }];
    const termInsured = play(termInsuredRun, 0);
    expect(termInsured.destroyedTileIds).not.toContain(hand[0]!.id);
    expect(termInsured.events).toContainEqual(expect.objectContaining({
      kind: 'joker',
      jokerId: 'termInsurance',
      multFactor: BALANCE.jokers.termInsurance.factor,
    }));
  });

  it('doubles the mult on the word it is played in', () => {
    // scoreWord applies materials BEFORE length (matches loop.ts::scoreSubmission):
    // glass doubles the suit mult only: mult = (1.0 × 2) + length 3 = 5.0
    // → 15 chips × 5.0 = 75
    const t = tiles('cat');
    t[0]!.material = 'glass';
    expect(scoreWord(t, lex).settledScore).toBe(75);
  });

  it('two glass tiles compound the factor', () => {
    const t = tiles('cat');
    t[0]!.material = 'glass';
    t[1]!.material = 'glass';
    // mult = (1.0 × 2 × 2) + length 3 = 7.0 → 15 × 7.0 = 105
    expect(scoreWord(t, lex).settledScore).toBe(105);
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

describe('slice5 — Brass (GDD §2.2, Balatro Steel)', () => {
  it('multiplies the current total Mult after owned Emoji Tile effects', () => {
    const word = tiles('cat');
    const heldBrass = tiles('x', 'brass');
    const run = newRun('brass-current-total');
    run.jokers = [{ defId: 'shortAndSharp', state: {} }];
    const blind = {
      ...startBlind(run, makeRng(run.seed)),
      hand: [...word, ...heldBrass],
      bag: [],
    };
    const result = submitWord(
      blind, run, lex, word.map((tile) => tile.id), makeRng('brass-current-total-score'),
    );
    const currentMult = BALANCE.suitMult.standard
      + word.length * BALANCE.wordLength.multPerLetter
      + BALANCE.jokers.shortAndSharp.mult;

    expect(result.submission.settledScore).toBe(
      letterChips(word) * currentMult * BALANCE.materials.brass.multFactor,
    );
    expect(result.events.findIndex(
      (event) => event.kind === 'material' && event.material === 'brass',
    )).toBeGreaterThan(result.events.findIndex(
      (event) => event.kind === 'joker' && event.jokerId === 'shortAndSharp',
    ));
  });

  it('multiplies mult per brass tile left in hand, not per brass tile played', () => {
    const run = { ...newRun('brass-seed'), bag: [...tiles('cat'), ...tiles('do', 'brass')] };
    const blind = startBlind(run, makeRng('brass-seed'));
    const played = blind.hand.filter((t) => t.material !== 'brass');
    const heldBrass = blind.hand.filter((t) => t.material === 'brass').length;
    const { events } = submitWord(
      blind, run, lex, played.map((t) => t.id), makeRng('r'),
    );
    const brassBeats = events.filter(
      (e): e is Extract<typeof e, { kind: 'material' }> =>
        e.kind === 'material' && e.material === 'brass',
    );
    expect(brassBeats).toHaveLength(heldBrass);
    expect(brassBeats.every((e) => e.multFactor === BALANCE.materials.brass.multFactor)).toBe(true);
  });

  it('a played brass tile does not pay the held bonus', () => {
    const run = { ...newRun('brass-seed'), bag: tiles('cat', 'brass') };
    const blind = startBlind(run, makeRng('brass-seed'));
    const { events } = submitWord(
      blind, run, lex, blind.hand.map((t) => t.id), makeRng('r'),
    );
    // every brass tile was played → none held → no brass beats
    expect(events.some((e) => e.kind === 'material' && e.material === 'brass')).toBe(false);
  });
});

describe('slice5 — Ivory (GDD §2.2, Balatro Gold)', () => {
  it('pays $3 per ivory tile held at blind end', () => {
    const run = { ...newRun('ivory-seed'), bag: tiles('cat', 'ivory') };
    const blind = startBlind(run, makeRng('ivory-seed'));
    const held = blind.hand.filter((t) => t.material === 'ivory').length;
    expect(endBlind(blind, run, lex).materialGold).toBe(3 * held);
  });

  it('pays nothing for ceramic hands', () => {
    const run = { ...newRun('ivory-seed'), bag: tiles('cat') };
    const blind = startBlind(run, makeRng('ivory-seed'));
    expect(endBlind(blind, run, lex).materialGold).toBe(0);
  });

  it('is pure — calling endBlind twice reports the same gold, never double-applies', () => {
    const run = { ...newRun('ivory-seed'), bag: tiles('cat', 'ivory') };
    const blind = startBlind(run, makeRng('ivory-seed'));
    const a = endBlind(blind, run, lex).materialGold;
    const b = endBlind(blind, run, lex).materialGold;
    expect(a).toBe(b);
    expect(run.gold).toBe(newRun('ivory-seed').gold); // untouched
  });
});
