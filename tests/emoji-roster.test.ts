/**
 * GDD §11 — the full authored Emoji Tile roster (Common 5 / Uncommon 9 /
 * Rare 11 / Legendary 5) as data + event hooks. Art assets are deliberately not
 * covered here: they land separately (§11 art canvas note).
 */
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { BALANCE } from '../src/engine/balance';
import { JokerBus } from '../src/engine/events';
import {
  ALL_JOKERS,
  COMMON_JOKERS,
  JOKER_REGISTRY,
  LEGENDARY_JOKERS,
  RARE_JOKERS,
  UNCOMMON_JOKERS,
  onBlindEnded,
} from '../src/engine/jokers';
import { startBlind } from '../src/engine/loop';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type {
  BlindState,
  Letter,
  RunState,
  Suit,
  Tile,
  TileMaterial,
  WordScoringContext,
  WordSubmission,
} from '../src/engine/types';

const bus = new JokerBus(JOKER_REGISTRY);
let tileId = 0;

interface WordOpts {
  suit?: Suit | null;
  gibberish?: boolean;
  material?: TileMaterial;
}

const submission = (text: string, opts: WordOpts = {}): WordSubmission => ({
  text,
  suit: opts.gibberish ? null : opts.suit ?? 'standard',
  isGibberish: opts.gibberish ?? false,
  posUsed: null,
  settledScore: 0,
  tiles: [...text.toUpperCase()].map((letter) => ({
    id: `roster-${tileId++}`,
    letter: letter as Letter,
    material: opts.material ?? 'ceramic',
    font: 'medium',
  } satisfies Tile)),
});

const runWith = (defId: string, over: Partial<RunState> = {}): RunState => {
  const run = newRun('roster');
  run.jokers = [{ defId, state: {} }];
  return Object.assign(run, over);
};

const ctxFor = (word: WordSubmission, mult = 1): WordScoringContext => ({
  submission: word,
  chips: 0,
  mult,
  scoringSuits: new Set(word.suit ? [word.suit] : []),
  scoreBonus: 0,
});

/** Fire the full per-word hook chain (rules → per tile → per word) for one joker. */
const play = (
  run: RunState,
  blind: BlindState,
  word: WordSubmission,
  mult = 1,
): WordScoringContext => {
  const ctx = ctxFor(word, mult);
  bus.emit('wordRules', { run, blind, ctx }, run.jokers);
  for (const tile of word.tiles) bus.emit('tileScoring', { run, blind, ctx, tile }, run.jokers);
  bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
  return ctx;
};

const blindFor = (run: RunState, seed = 'roster'): BlindState =>
  startBlind(run, makeRng(seed));

const fixedRng = (value: number): Rng => ({
  next: () => value,
  int: () => value,
  shuffle: <T,>(items: readonly T[]) => [...items],
});

describe('GDD §11 roster shape', () => {
  it('registers Common 24 / Uncommon 42 / Rare 45 / Legendary 5', () => {
    expect(COMMON_JOKERS).toHaveLength(24);
    expect(UNCOMMON_JOKERS).toHaveLength(42);
    expect(RARE_JOKERS).toHaveLength(45);
    expect(LEGENDARY_JOKERS).toHaveLength(5);
    expect(ALL_JOKERS).toHaveLength(116);
    expect(JOKER_REGISTRY.size).toBe(ALL_JOKERS.length);
  });

  it('gives every tile a name and both locale effect strings', () => {
    const enKeys: Record<string, string> = en;
    const koKeys: Record<string, string> = ko;
    for (const def of ALL_JOKERS) {
      expect(def.nameEn.length, def.id).toBeGreaterThan(0);
      expect(def.nameKo.length, def.id).toBeGreaterThan(0);
      expect(enKeys[`jokerdesc.${def.id}`], def.id).toBeTruthy();
      expect(koKeys[`jokerdesc.${def.id}`], def.id).toBeTruthy();
    }
  });
});

describe('Common — §11.2', () => {
  it('Ceramic Artisan pays only on un-enhanced base tiles', () => {
    const run = runWith('ceramicArtisan');
    expect(play(run, blindFor(run), submission('cat')).chips).toBe(15);
    expect(play(run, blindFor(run), submission('cat', { material: 'glass' })).chips).toBe(0);
  });

  it('Long-Word Fan and Short & Sharp split at the length thresholds', () => {
    const long = runWith('longWordFan');
    expect(play(long, blindFor(long), submission('paper')).chips).toBe(30);
    expect(play(long, blindFor(long), submission('pen')).chips).toBe(0);

    const short = runWith('shortAndSharp');
    expect(play(short, blindFor(short), submission('pen')).mult).toBe(9);
    expect(play(short, blindFor(short), submission('paper')).mult).toBe(1);
  });

  it('Alphabetical Order pays Mult once for a consecutive pair', () => {
    const run = runWith('alphabeticalOrder');
    expect(play(run, blindFor(run), submission('abcd')).mult).toBe(16);
    expect(play(run, blindFor(run), submission('dog')).mult).toBe(1);
  });

  it('Miser scales with gold held', () => {
    const run = runWith('miser', { gold: 23 });
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1 + 4);
  });
});

describe('Uncommon — §11.3', () => {
  it('Literary Judge pays on Formal, including a virtual Formal', () => {
    const run = runWith('literaryJudge');
    const blind = blindFor(run);
    expect(play(run, blind, submission('cat')).chips).toBe(0);
    expect(play(run, blind, submission('edict', { suit: 'formal' })).chips).toBe(50);
  });

  it('Rare Earth triples only Q · Z · X · J chips', () => {
    const run = runWith('rareEarth');
    const blind = blindFor(run);
    expect(play(run, blind, submission('qz')).chips).toBe(
      (BALANCE.letterChips.Q! + BALANCE.letterChips.Z!) * 2,
    );
    expect(play(run, blind, submission('cat')).chips).toBe(0);
  });

  it('Glasswork pays per Glass tile and eats one Glass tile per blind', () => {
    const run = runWith('glasswork');
    const blind = blindFor(run);
    expect(play(run, blind, submission('cat', { material: 'glass' })).mult).toBe(1 + 15);

    run.bag = run.bag.map((tile, i) => (i < 2 ? { ...tile, material: 'glass' } : tile));
    const after = onBlindEnded(run, blind, fixedRng(1));
    expect(after.bag.filter((tile) => tile.material === 'glass')).toHaveLength(1);
    expect(after.bag).toHaveLength(run.bag.length - 1);
    expect(run.bag.filter((tile) => tile.material === 'glass')).toHaveLength(2); // input untouched
  });

  it('Glasswork s pouch loss feeds Type Foundry s destruction growth', () => {
    const run = newRun('roster-glass-foundry');
    run.jokers = [{ defId: 'glasswork', state: {} }, { defId: 'typeFoundry', state: {} }];
    run.bag = run.bag.map((tile, i) => (i === 0 ? { ...tile, material: 'glass' } : tile));
    const after = onBlindEnded(run, blindFor(run), fixedRng(1));
    expect(after.jokers[1]?.state.factor).toBe(BALANCE.jokers.typeFoundry.factorPerTile);
  });

  it('Voracious Reader pays the words-so-far total, then ticks', () => {
    const run = runWith('voraciousReader');
    const blind = blindFor(run);
    expect(play(run, blind, submission('cat')).chips).toBe(0);
    expect(play(run, blind, submission('dog')).chips).toBe(1);
    expect(run.jokers[0]?.state.chips).toBe(2);
  });

  it('Classicist and Street Cred grow only on their own register', () => {
    const formal = runWith('classicist');
    const fb = blindFor(formal);
    expect(play(formal, fb, submission('edict', { suit: 'formal' })).mult).toBe(1);
    expect(play(formal, fb, submission('edict', { suit: 'formal' })).mult).toBe(2);
    expect(play(formal, fb, submission('cat')).mult).toBe(3);
    expect(formal.jokers[0]?.state.mult).toBe(2);

    const slang = runWith('streetCred');
    const sb = blindFor(slang);
    expect(play(slang, sb, submission('yo', { suit: 'slang' })).chips).toBe(0);
    expect(play(slang, sb, submission('cat')).chips).toBe(8);
  });

  it('Combo Artist needs a real register change, not a gibberish hole', () => {
    const run = runWith('comboArtist');
    const base = blindFor(run);
    const changed = { ...base, sequence: [submission('yo', { suit: 'slang' })] };
    expect(play(run, changed, submission('cat')).mult).toBe(1 + 6);
    const same = { ...base, sequence: [submission('dog')] };
    expect(play(run, same, submission('cat')).mult).toBe(1);
    const hole = { ...base, sequence: [submission('zzq', { gibberish: true })] };
    expect(play(run, hole, submission('cat')).mult).toBe(1);
  });

  it('Vowel Magnet and Equilibrist count vowels against consonants', () => {
    const magnet = runWith('vowelMagnet');
    const mb = blindFor(magnet);
    expect(play(magnet, mb, submission('aim')).mult).toBe(1.5);
    expect(play(magnet, mb, submission('cat')).mult).toBe(1);

    const balance = runWith('equilibrist');
    const eb = blindFor(balance);
    const even = play(balance, eb, submission('at'));
    expect([even.chips, even.mult]).toEqual([40, 5]);
    expect(play(balance, eb, submission('cat')).chips).toBe(0);
  });
});

describe('Rare — §11.4', () => {
  it('Out of Print pays per alphabet letter wiped from the pouch', () => {
    const run = runWith('outOfPrint');
    expect(play(run, blindFor(run), submission('cat')).chips).toBe(0);
    run.bag = run.bag.filter((tile) => tile.letter !== 'Q' && tile.letter !== 'Z');
    const ctx = play(run, blindFor(run), submission('cat'));
    expect([ctx.chips, ctx.mult]).toEqual([50, 7]);
  });

  it('Fable Hoard compounds per held consumable', () => {
    const run = runWith('fableHoard', { consumables: ['fable1', 'fable2'] });
    expect(play(run, blindFor(run), submission('cat')).mult).toBeCloseTo(1.5625);
  });

  it('Anonymous fires only on a full effective shelf', () => {
    const run = runWith('anonymous');
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    run.jokerSlots = 1;
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(2.5);
  });

  it('Censor s Bane fires only on Deadline blinds', () => {
    const run = runWith('censorsBane');
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    const boss = startBlind(run, makeRng('boss'), { kind: 'boss', bossId: 'wanted' });
    expect(play(run, boss, submission('cat')).mult).toBe(2.5);
  });

  it('Interest Glutton banks the round s interest for the next round', () => {
    const run = runWith('interestGlutton', { gold: 17 });
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    const after = onBlindEnded(run, blindFor(run), fixedRng(1));
    expect(after.jokers[0]?.state.mult).toBe(3 * 2); // $17 → $3 interest (cap 5)
    expect(play(after, blindFor(after), submission('cat')).mult).toBe(7);
  });
});

describe('Legendary — §11.5', () => {
  it('Tyrant makes every valid word a doubled Vulgar without rewriting its suit', () => {
    const run = runWith('tyrant');
    const blind = blindFor(run);
    const standard = play(run, blind, submission('cat'), BALANCE.suitMult.standard);
    expect(standard.mult).toBe(BALANCE.suitMult.vulgar * 2);
    expect(standard.submission.suit).toBe('standard');
    expect(standard.scoringSuits?.has('vulgar')).toBe(true);

    const formal = play(run, blind, submission('edict', { suit: 'formal' }), BALANCE.suitMult.formal);
    expect(formal.mult).toBe(BALANCE.suitMult.vulgar * 2);

    const gibberish = play(run, blind, submission('zzq', { gibberish: true }), 1);
    expect(gibberish.mult).toBe(1);
    expect(gibberish.scoringSuits?.has('vulgar')).toBe(false);
  });
});
