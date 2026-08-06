/**
 * GDD §11 — the full authored Emoji Tile roster as data + event hooks.
 * Art registration and dimensions are covered in emoji-sample.test.ts.
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
  onBlindEndedWithDestroyedJokers,
  onTilesEnhanced,
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
  baseSuit: word.suit,
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
  it('registers Common 29 / Uncommon 47 / Rare 48 / Legendary 5', () => {
    expect(COMMON_JOKERS).toHaveLength(29);
    expect(UNCOMMON_JOKERS).toHaveLength(47);
    expect(RARE_JOKERS).toHaveLength(48);
    expect(LEGENDARY_JOKERS).toHaveLength(5);
    expect(ALL_JOKERS).toHaveLength(129);
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
  it('applies blind-start discard and hand-size bonuses', () => {
    const run = newRun('blind-start-jokers');
    run.jokers = [
      { defId: 'proofEraser', state: {} },
      { defId: 'spareDrawer', state: {} },
    ];
    const blind = blindFor(run);
    expect(blind.discardsLeft).toBe(run.baseDiscards + BALANCE.jokers.proofEraser.discards);
    expect(blind.handSizeTotal).toBe(run.handSize + BALANCE.jokers.spareDrawer.handSize);
    expect(blind.hand).toHaveLength(blind.handSizeTotal);
  });

  it('Dulling Pencil loses Chips after each played hand', () => {
    const run = runWith('dullingPencil');
    const blind = blindFor(run);
    const ctx = ctxFor(submission('cat'));
    const growth = bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.chips).toBe(BALANCE.jokers.dullingPencil.chips);
    expect(run.jokers[0]?.state.chips).toBe(
      BALANCE.jokers.dullingPencil.chips - BALANCE.jokers.dullingPencil.chipsLostPerHand,
    );
    expect(growth).toContainEqual({
      jokerId: 'dullingPencil',
      kind: 'chips',
      delta: -BALANCE.jokers.dullingPencil.chipsLostPerHand,
    });
    run.jokers[0]!.state.chips = BALANCE.jokers.dullingPencil.chipsLostPerHand;
    play(run, blind, submission('cat'));
    expect(run.jokers[0]?.state).toMatchObject({ chips: 0, destroyed: 1 });
  });

  it('Ceramic Artisan pays only on un-enhanced base tiles', () => {
    const run = runWith('ceramicArtisan');
    expect(play(run, blindFor(run), submission('cat')).chips).toBe(3 * BALANCE.jokers.ceramicArtisan.chips);
    expect(play(run, blindFor(run), submission('cat', { material: 'glass' })).chips).toBe(0);
  });

  it('Porcelain Cat pays when the word contains Porcelain, never base Ceramic', () => {
    const run = runWith('porcelainCat');
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    expect(play(run, blindFor(run), submission('cat', { material: 'porcelain' })).mult)
      .toBe(1 + BALANCE.jokers.porcelainCat.mult);
  });

  it('Long-Word Fan and Short & Sharp split at the length thresholds', () => {
    const long = runWith('longWordFan');
    expect(play(long, blindFor(long), submission('paper')).chips).toBe(BALANCE.jokers.longWordFan.chips);
    expect(play(long, blindFor(long), submission('pen')).chips).toBe(0);

    const short = runWith('shortAndSharp');
    expect(play(short, blindFor(short), submission('pen')).mult).toBe(1 + BALANCE.jokers.shortAndSharp.mult);
    expect(play(short, blindFor(short), submission('paper')).mult).toBe(1);
  });

  it('Alphabetical Order pays Mult once for a consecutive pair', () => {
    const run = runWith('alphabeticalOrder');
    expect(play(run, blindFor(run), submission('abcd')).mult).toBe(1 + BALANCE.jokers.alphabeticalOrder.mult);
    expect(play(run, blindFor(run), submission('dog')).mult).toBe(1);
  });

  it('Miser scales with gold held', () => {
    const run = runWith('miser', { gold: 23 });
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(
      1 + Math.floor(23 / BALANCE.jokers.miser.goldPer) * BALANCE.jokers.miser.mult,
    );
  });

  it('Stenographer triggers once only for a strictly shorter word', () => {
    const run = runWith('stenographer');
    const blind = blindFor(run);
    expect(JOKER_REGISTRY.get('stenographer')?.nameKo).toBe('속기사');
    expect(play(run, { ...blind, sequence: [] }, submission('cat')).mult).toBe(1);
    expect(play(run, { ...blind, sequence: [submission('dog')] }, submission('cat')).mult).toBe(1);
    expect(play(run, { ...blind, sequence: [submission('paper')] }, submission('cat')).mult).toBe(
      1 + BALANCE.jokers.stenographer.mult,
    );
  });
});

describe('Uncommon — §11.3', () => {
  it('Drying Ink loses Mult after a vowel word', () => {
    const run = runWith('dryingInk');
    const blind = blindFor(run);
    const ctx = ctxFor(submission('cat'));
    ctx.scoringVowels = new Set(['A', 'E', 'I', 'O', 'U']);
    const growth = bus.emit('wordScoring', { run, blind, ctx }, run.jokers);
    expect(ctx.mult).toBe(1 + BALANCE.jokers.dryingInk.mult);
    expect(run.jokers[0]?.state.mult).toBe(
      BALANCE.jokers.dryingInk.mult - BALANCE.jokers.dryingInk.multLostPerVowelWord,
    );
    expect(growth).toContainEqual({
      jokerId: 'dryingInk',
      kind: 'multAdd',
      delta: -BALANCE.jokers.dryingInk.multLostPerVowelWord,
    });

    const nextCtx = ctxFor(submission('cry'));
    nextCtx.scoringVowels = new Set(['A', 'E', 'I', 'O', 'U']);
    bus.emit('wordScoring', { run, blind, ctx: nextCtx }, run.jokers);
    expect(nextCtx.mult).toBe(
      1 + BALANCE.jokers.dryingInk.mult - BALANCE.jokers.dryingInk.multLostPerVowelWord,
    );
    run.jokers[0]!.state.mult = BALANCE.jokers.dryingInk.multLostPerVowelWord;
    const expiringCtx = ctxFor(submission('cat'));
    expiringCtx.scoringVowels = new Set(['A', 'E', 'I', 'O', 'U']);
    bus.emit('wordScoring', { run, blind, ctx: expiringCtx }, run.jokers);
    expect(run.jokers[0]?.state).toMatchObject({ mult: 0, destroyed: 1 });
  });

  it('Folding Manuscript starts at +2 hand size then shrinks each blind', () => {
    const run = runWith('foldingManuscript');
    expect(BALANCE.jokers.foldingManuscript.handSize).toBe(2);
    const first = blindFor(run);
    expect(first.handSizeTotal).toBe(run.handSize + BALANCE.jokers.foldingManuscript.handSize);
    const after = onBlindEnded(run, first, fixedRng(1));
    const second = blindFor(after, 'folding-two');
    expect(second.handSizeTotal).toBe(
      run.handSize
      + BALANCE.jokers.foldingManuscript.handSize
      - BALANCE.jokers.foldingManuscript.handSizeLostPerBlind,
    );
    run.jokers[0]!.state.handSize = BALANCE.jokers.foldingManuscript.handSizeLostPerBlind;
    const terminal = onBlindEndedWithDestroyedJokers(run, first, fixedRng(1));
    expect(terminal.run.jokers).toHaveLength(0);
    expect(terminal.destroyedJokers).toEqual([{
      joker: expect.objectContaining({
        defId: 'foldingManuscript',
        state: expect.objectContaining({ handSize: 0, destroyed: 1 }),
      }),
      index: 0,
    }]);
    expect(JOKER_REGISTRY.get('foldingManuscript')?.growthDisplay).toMatchObject({
      kind: 'handSize',
      showDecrease: true,
    });
  });

  it('Hollow Promise pays per Inline discard blocked by full slots', () => {
    const run = runWith('hollowPromise', { gold: 0 });
    const blind = blindFor(run);
    bus.emit(
      'discardUsed',
      { run, blind, tiles: [], gained: 0, slotsBlocked: 2 },
      run.jokers,
    );
    expect(run.gold).toBe(2 * BALANCE.jokers.hollowPromise.gold);
  });

  it('Literary Judge pays on Formal, including a virtual Formal', () => {
    const run = runWith('literaryJudge');
    const blind = blindFor(run);
    expect(play(run, blind, submission('cat')).chips).toBe(0);
    expect(play(run, blind, submission('edict', { suit: 'formal' })).chips).toBe(BALANCE.jokers.literaryJudge.chips);
  });

  it('Rare Earth triples only Q · Z · X · J chips', () => {
    const run = runWith('rareEarth');
    const blind = blindFor(run);
    expect(play(run, blind, submission('qz')).chips).toBe(
      (BALANCE.letterChips.Q! + BALANCE.letterChips.Z!) * (BALANCE.jokers.rareEarth.factor - 1),
    );
    expect(play(run, blind, submission('cat')).chips).toBe(0);
  });

  it('Glasswork pays per Glass tile without removing one at blind end', () => {
    const run = runWith('glasswork');
    const blind = blindFor(run);
    expect(play(run, blind, submission('cat', { material: 'glass' })).mult).toBe(
      1 + 3 * BALANCE.jokers.glasswork.multPerGlass,
    );

    run.bag = run.bag.map((tile, i) => (i < 2 ? { ...tile, material: 'glass' } : tile));
    const after = onBlindEnded(run, blind, fixedRng(1));
    expect(after.bag).toEqual(run.bag);
  });

  it('Voracious Reader pays the words-so-far total, then ticks', () => {
    const run = runWith('voraciousReader');
    const blind = blindFor(run);
    expect(play(run, blind, submission('cat')).chips).toBe(0);
    expect(play(run, blind, submission('dog')).chips).toBe(BALANCE.jokers.voraciousReader.chipsPerWord);
    expect(run.jokers[0]?.state.chips).toBe(2 * BALANCE.jokers.voraciousReader.chipsPerWord);
  });

  it('Classicist and Street Cred grow only on their own register', () => {
    const formal = runWith('classicist');
    const fb = blindFor(formal);
    expect(play(formal, fb, submission('edict', { suit: 'formal' })).mult).toBe(1);
    expect(play(formal, fb, submission('edict', { suit: 'formal' })).mult).toBe(
      1 + BALANCE.jokers.classicist.multPerFormal,
    );
    expect(play(formal, fb, submission('cat')).mult).toBe(
      1 + 2 * BALANCE.jokers.classicist.multPerFormal,
    );
    expect(formal.jokers[0]?.state.mult).toBe(2 * BALANCE.jokers.classicist.multPerFormal);

    const slang = runWith('streetCred');
    const sb = blindFor(slang);
    expect(play(slang, sb, submission('yo', { suit: 'slang' })).chips).toBe(0);
    expect(play(slang, sb, submission('cat')).chips).toBe(BALANCE.jokers.streetCred.chipsPerSlang);
  });

  it('Combo Artist needs a real register change, not a gibberish hole', () => {
    const run = runWith('comboArtist');
    const base = blindFor(run);
    const changed = { ...base, sequence: [submission('yo', { suit: 'slang' })] };
    expect(play(run, changed, submission('cat')).mult).toBe(1 + BALANCE.jokers.comboArtist.mult);
    const same = { ...base, sequence: [submission('dog')] };
    expect(play(run, same, submission('cat')).mult).toBe(1);
    const hole = { ...base, sequence: [submission('zzq', { gibberish: true })] };
    expect(play(run, hole, submission('cat')).mult).toBe(1);
  });

  it('Correction Mark needs a shared final register; bare gibberish has none', () => {
    const run = runWith('correctionMark');
    const base = blindFor(run);
    const same = { ...base, sequence: [submission('know')] };
    expect(play(run, same, submission('word')).mult).toBe(
      1 + BALANCE.jokers.correctionMark.mult,
    );
    const different = {
      ...base,
      sequence: [submission('yo', { suit: 'slang' })],
    };
    expect(play(run, different, submission('word')).mult).toBe(1);
    const hole = {
      ...base,
      sequence: [submission('whno', { gibberish: true })],
    };
    expect(play(run, hole, submission('word')).mult).toBe(1);
    const rewrittenHole = submission('whno', { gibberish: true });
    rewrittenHole.effectiveSuits = ['standard'];
    expect(play(run, same, rewrittenHole).mult).toBe(
      1 + BALANCE.jokers.correctionMark.mult,
    );
  });

  it('Vowel Magnet and Equilibrist count vowels against consonants', () => {
    const magnet = runWith('vowelMagnet');
    const mb = blindFor(magnet);
    expect(play(magnet, mb, submission('aim')).mult).toBe(BALANCE.jokers.vowelMagnet.factor);
    expect(play(magnet, mb, submission('cat')).mult).toBe(1);

    const balance = runWith('equilibrist');
    const eb = blindFor(balance);
    const even = play(balance, eb, submission('at'));
    expect([even.chips, even.mult]).toEqual([
      BALANCE.jokers.equilibrist.chips,
      1 + BALANCE.jokers.equilibrist.mult,
    ]);
    expect(play(balance, eb, submission('cat')).chips).toBe(0);
  });
});

describe('Rare — §11.4', () => {
  it('Blacksmith gains +10 Chips per enhanced letter tile and scores its total', () => {
    const run = runWith('blacksmith');
    const after = onTilesEnhanced(run, 3);
    expect(after.jokers[0]?.state.chips).toBe(
      3 * BALANCE.jokers.blacksmith.chipsPerEnhancement,
    );
    expect(play(after, blindFor(after), submission('cat')).chips).toBe(30);
  });

  it('Out of Print pays per alphabet letter wiped from the pouch', () => {
    const run = runWith('outOfPrint');
    expect(play(run, blindFor(run), submission('cat')).chips).toBe(0);
    run.bag = run.bag.filter((tile) => tile.letter !== 'Q' && tile.letter !== 'Z');
    const ctx = play(run, blindFor(run), submission('cat'));
    expect([ctx.chips, ctx.mult]).toEqual([
      2 * BALANCE.jokers.outOfPrint.chipsPerLetter,
      1 + 2 * BALANCE.jokers.outOfPrint.multPerLetter,
    ]);
  });

  it('Fable Hoard compounds per held consumable', () => {
    const run = runWith('fableHoard', { consumables: ['fable1', 'fable2'] });
    expect(play(run, blindFor(run), submission('cat')).mult).toBeCloseTo(
      BALANCE.jokers.fableHoard.factorPerConsumable ** 2,
    );
  });

  it('Anonymous fires only on a full effective shelf', () => {
    const run = runWith('anonymous');
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    run.jokerSlots = 1;
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(BALANCE.jokers.anonymous.factor);
  });

  it('Censor s Bane fires only on Deadline blinds', () => {
    const run = runWith('censorsBane');
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    const boss = startBlind(run, makeRng('boss'), { kind: 'boss', bossId: 'wanted' });
    expect(play(run, boss, submission('cat')).mult).toBe(BALANCE.jokers.censorsBane.factor);
  });

  it('Interest Glutton banks the round s interest for the next round', () => {
    const run = runWith('interestGlutton', { gold: 17 });
    expect(play(run, blindFor(run), submission('cat')).mult).toBe(1);
    const after = onBlindEnded(run, blindFor(run), fixedRng(1));
    expect(after.jokers[0]?.state.mult).toBe(3 * BALANCE.jokers.interestGlutton.multPerGold); // $17 → $3 interest (cap 5)
    expect(play(after, blindFor(after), submission('cat')).mult).toBe(
      1 + 3 * BALANCE.jokers.interestGlutton.multPerGold,
    );
  });
});

describe('Legendary — §11.5', () => {
  it('keeps the configured Legendary balance values', () => {
    expect(BALANCE.jokers.bookOfMargins).toEqual({ slots: 3, factorPerEmptySlot: 2 });
    expect(BALANCE.jokers.tyrant).toEqual({ vulgarFactor: 2 });
    expect(BALANCE.jokers.typeFoundry).toEqual({ factorPerTile: 1.5 });
    expect(BALANCE.jokers.misbound).toEqual({ destroyDenominator: 100, factorPerSurvival: 0.8 });
  });

  it('Tyrant rewrites every valid word to doubled Vulgar', () => {
    const run = runWith('tyrant');
    const blind = blindFor(run);
    const standard = play(run, blind, submission('cat'), BALANCE.suitMult.standard);
    expect(standard.mult).toBe(BALANCE.suitMult.vulgar * 2);
    expect(standard.submission.suit).toBe('vulgar');
    expect(standard.scoringSuits?.has('vulgar')).toBe(true);

    const formal = play(run, blind, submission('edict', { suit: 'formal' }), BALANCE.suitMult.formal);
    expect(formal.mult).toBe(BALANCE.suitMult.vulgar * 2);

    const gibberish = play(run, blind, submission('zzq', { gibberish: true }), 1);
    expect(gibberish.mult).toBe(1);
    expect(gibberish.scoringSuits?.has('vulgar')).toBe(false);
  });
});
