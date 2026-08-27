import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import {
  blindTarget,
  effectiveBlindTarget,
  effectiveClearReward,
  effectiveInterest,
} from '../src/engine/economy';
import { isGamblerId } from '../src/engine/gamblers';
import { ORDINARY_GAMBLER_IDS } from '../src/engine/gamblerIds';
import { onBlindEnded } from '../src/engine/jokers';
import { makeLexicon } from '../src/engine/lexicon';
import { endBlind, startBlind, submitWord } from '../src/engine/loop';
import {
  isPouchUnlocked,
  pouchAllowsGamblerShop,
} from '../src/engine/pouches';
import { resolveBlind } from '../src/engine/progression';
import { isRecordUnlocked } from '../src/engine/records';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { rollShopStock } from '../src/engine/shop';
import type { Letter, PouchId, RecordId, Tile } from '../src/engine/types';

const runWith = (pouchId: PouchId, recordId: RecordId = 'whiteLp', seed = 'setup') =>
  newRun(seed, { pouchId, recordId });

describe('starting pouches', () => {
  it('applies the four basic resource/economy identities', () => {
    expect(runWith('yellow').baseDiscards).toBe(
      BALANCE.discardsPerBlind + BALANCE.pouches.yellow.discards,
    );
    expect(runWith('blue').basePhases).toBe(BALANCE.basePhases + BALANCE.pouches.blue.phases);
    expect(runWith('green').gold).toBe(BALANCE.startingGold + BALANCE.pouches.green.gold);

    const purple = { ...runWith('purple'), gold: 25 };
    const blind = {
      ...startBlind(purple, makeRng('purple-blind'), { target: 1 }),
      phasesUsed: 3,
      discardsLeft: 2,
    };
    const out = resolveBlind(purple, blind, 1);
    expect(out.earned).toEqual({
      reward: BALANCE.clearReward.small,
      tagReward: 0,
      phaseCount: 2,
      phases: 4,
      discardCount: 2,
      discards: 2,
      interest: 0,
      total: 9,
      letterHandReward: expect.objectContaining({ stamps: 1, random: true }),
    });
  });

  it('applies slots, hand size, phase penalties, materials, vouchers, and cards', () => {
    const five = runWith('fiveColor');
    expect(BALANCE.handSize).toBe(10);
    expect(five.handSize).toBe(BALANCE.handSize + 1);
    expect(five.jokerSlots).toBe(BALANCE.jokerSlots - 1);

    const leather = runWith('leather');
    expect(leather.jokerSlots).toBe(BALANCE.jokerSlots + 1);
    expect(leather.basePhases).toBe(BALANCE.basePhases - 1);

    const golden = runWith('golden');
    expect(golden.bag.filter((tile) => 'AEIOU'.includes(tile.letter ?? ''))).toSatisfy(
      (tiles: Tile[]) => tiles.length > 0 && tiles.every((tile) => tile.material === 'brass'),
    );
    expect(golden.bag.filter((tile) => !'AEIOU'.includes(tile.letter ?? ''))).toSatisfy(
      (tiles: Tile[]) => tiles.every((tile) => tile.material === 'ceramic'),
    );

    const military = runWith('military');
    expect(military.vouchers).toContain('bwPhoto');
    expect(military.consumableSlots).toBe(BALANCE.consumableSlots - 1);

    const luxury = runWith('luxury');
    expect(luxury.vouchers).toContain('newspaper');
    expect(luxury.consumables).toEqual(['fable9', 'fable9']);

    const pencil = runWith('pencilCase');
    expect(pencil.vouchers).toContain('zeroScore');
    expect(pencil.consumableSlots).toBe(BALANCE.consumableSlots + 1);
    expect(pencil.consumables).toEqual(['fable2', 'fable2']);

    const basket = runWith('shoppingBasket');
    expect(basket.vouchers).toEqual(['storyBook', 'bible', 'catalog']);
  });

  it('composes pouch bonuses with cumulative Record penalties before resource floors', () => {
    expect(runWith('yellow', 'yellowLp').baseDiscards).toBe(BALANCE.discardsPerBlind);
    expect(runWith('blue', 'clearLp').basePhases).toBe(BALANCE.basePhases);
    expect(runWith('fiveColor', 'blueLp').handSize).toBe(BALANCE.handSize);
    expect(runWith('fiveColor', 'cd').jokerSlots).toBe(BALANCE.jokerSlots - 2);
    expect(runWith('leather', 'cd').jokerSlots).toBe(BALANCE.jokerSlots);
  });

  it('uses seeded setup for Lucky Pouch and Coin Purse', () => {
    const luckyA = runWith('lucky', 'whiteLp', 'lucky-seed');
    const luckyB = runWith('lucky', 'whiteLp', 'lucky-seed');
    expect(luckyA.consumables).toEqual(luckyB.consumables);
    expect(luckyA.consumables[0] && isGamblerId(luckyA.consumables[0])).toBe(true);
    expect(ORDINARY_GAMBLER_IDS).toContain(luckyA.consumables[0]);
    expect(pouchAllowsGamblerShop(luckyA)).toBe(true);
    for (let i = 0; i < 200; i++) {
      expect(ORDINARY_GAMBLER_IDS).toContain(runWith('lucky', 'whiteLp', `lucky-${i}`).consumables[0]);
    }

    const coinA = runWith('coinPurse', 'whiteLp', 'coin-seed');
    const coinB = runWith('coinPurse', 'whiteLp', 'coin-seed');
    expect(coinA.bag).toHaveLength(Object.values(BALANCE.bagComposition).reduce((a, b) => a + b, 0));
    expect(coinA.bag.map((tile) => tile.letter)).toEqual(coinB.bag.map((tile) => tile.letter));
    expect(coinA.bag.map((tile) => tile.letter)).not.toEqual(
      runWith('yellow', 'whiteLp', 'coin-seed').bag.map((tile) => tile.letter),
    );
  });

  it('lets Gambler cards appear in Lucky Pouch shop consumable slots', () => {
    const run = runWith('lucky');
    let found = false;
    for (let i = 0; i < 400; i++) {
      const shop = rollShopStock(run, makeRng(`lucky-shop-${i}`));
      for (const item of shop.items) {
        if (item?.kind !== 'consumable' || !isGamblerId(item.id)) continue;
        found = true;
        expect(ORDINARY_GAMBLER_IDS).toContain(item.id);
      }
    }
    expect(found).toBe(true);
  });

  it('balances word and sentence Chips/Mult for Briefcase after hooks', () => {
    const lexicon = makeLexicon([], {
      cat: { suit: 'standard', pos: ['interjection'] },
    });
    const run = runWith('lunchBag');
    const base = startBlind(run, makeRng('lunch-blind'), { target: 9999 });
    const letters = [...'CAT'] as Letter[];
    const wordTiles: Tile[] = letters.map((letter, index) => ({
      id: `lunch-${index}`,
      letter,
      material: 'ceramic',
      font: 'medium',
      edition: 'base',
    }));
    const blind = { ...base, hand: [...wordTiles, ...base.hand.slice(wordTiles.length)] };
    const result = submitWord(
      blind,
      run,
      lexicon,
      wordTiles.map((tile) => tile.id),
      makeRng('lunch-score'),
    );
    expect(result.submission.settledScore).toBe(90.25); // 15×4 becomes 9.5×9.5
    expect(result.events).toContainEqual({
      kind: 'pouch',
      pouchId: 'lunchBag',
      chipsDelta: -5.5,
      multDelta: 5.5,
    });
    const final = endBlind(result.blind, run, lexicon);
    expect(final.sentenceChips).toBe(13); // Outcry 25×1 becomes 13×13
    expect(final.sentenceMult).toBe(13);
    expect(final.breakdown).toMatchObject({
      pouchId: 'lunchBag',
      pouchChipsDelta: -12,
      pouchMultDelta: 12,
    });
  });

  it('balances Briefcase axes after mixed-register Chips', () => {
    const lexicon = makeLexicon([], {
      edict: { suit: 'formal', pos: ['noun'] },
      run: { suit: 'standard', pos: ['verbIntransitive'] },
    });
    const run = runWith('lunchBag');
    let blind = startBlind(run, makeRng('briefcase-register'), { target: 999_999 });
    for (const text of ['EDICT', 'RUN']) {
      const tiles: Tile[] = [...text].map((letter, index) => ({
        id: `${text}-${index}`,
        letter: letter as Letter,
        material: 'ceramic',
        font: 'medium',
        edition: 'base',
      }));
      ({ blind } = submitWord(
        { ...blind, hand: tiles },
        run,
        lexicon,
        tiles.map((tile) => tile.id),
        makeRng(`briefcase-register-${text}`),
      ));
    }

    const final = endBlind(blind, run, lexicon);
    const rawChips = (blind.committedScore + BALANCE.patterns.simple.baseChips) *
      BALANCE.registerSynergies.harmony.chipsFactor - blind.committedScore;
    const balancedAxis = (rawChips + BALANCE.patterns.simple.baseMult) / 2;
    expect(final.judgment.registerSynergy?.id).toBe('harmony');
    expect(final.sentenceChips).toBe(balancedAxis);
    expect(final.sentenceMult).toBe(balancedAxis);
    expect(final.breakdown.pouchId).toBe('lunchBag');
  });
});

describe('cumulative Record difficulty', () => {
  it('stacks every penalty through DVD', () => {
    const run = runWith('yellow', 'dvd');
    expect(run.handSize).toBe(BALANCE.handSize - 1);
    expect(run.baseDiscards).toBe(BALANCE.discardsPerBlind);
    expect(run.basePhases).toBe(BALANCE.basePhases - 1);
    expect(run.jokerSlots).toBe(BALANCE.jokerSlots - 1);
    expect(effectiveClearReward(run, 'small')).toBe(0);
    expect(effectiveInterest({ ...run, gold: 100 })).toBe(0);
  });

  it('grows targets faster from Chapter 2 and combines with Briefcase ×2', () => {
    const green = { ...runWith('yellow', 'greenLp'), ante: 2 };
    expect(effectiveBlindTarget(green, 'small')).toBe(
      Math.round(BALANCE.anteBaseTargets[1]! * BALANCE.records.greenTargetGrowth),
    );
    const lunch = { ...runWith('lunchBag', 'greenLp'), ante: 2 };
    expect(effectiveBlindTarget(lunch, 'small')).toBe(
      Math.round(
        BALANCE.anteBaseTargets[1]! *
          BALANCE.records.greenTargetGrowth *
          BALANCE.pouches.lunchBag.targetMult,
      ),
    );
    const bossScaled = { ...lunch, ante: 3 };
    expect(
      effectiveBlindTarget(bossScaled, 'boss', BALANCE.boss.wantedTargetMult),
    ).toBe(
      Math.round(
        blindTarget(3, 'boss') *
          Math.pow(BALANCE.records.greenTargetGrowth, 2) *
          BALANCE.pouches.lunchBag.targetMult *
          BALANCE.boss.wantedTargetMult,
      ),
    );
  });

  it('makes Purple Pouch interest-based Emoji Tiles receive zero interest', () => {
    const run = {
      ...runWith('purple'),
      gold: 100,
      jokers: [{ defId: 'interestGlutton', edition: 'base' as const, state: {} }],
    };
    const blind = startBlind(run, makeRng('purple-interest'), { target: 1 });
    const ended = onBlindEnded(run, blind, makeRng('purple-interest-end'));
    const after = resolveBlind(ended, blind, blind.target).run;
    expect(after.jokers[0]?.state.mult).toBe(0);
  });
});

describe('pouch and Record unlock rules', () => {
  const progress = {
    discoveredWords: 50,
    pouchWins: new Set<PouchId>(['yellow']),
    recordWins: new Set<RecordId>(['whiteLp']),
  };

  it('uses collection counts plus pouch/Record wins', () => {
    expect(isPouchUnlocked('yellow', progress)).toBe(true);
    expect(isPouchUnlocked('blue', progress)).toBe(true);
    expect(isPouchUnlocked('green', progress)).toBe(true);
    expect(isPouchUnlocked('purple', progress)).toBe(false);
    expect(isPouchUnlocked('lucky', progress)).toBe(true);
    expect(isPouchUnlocked('military', progress)).toBe(true);
    expect(isPouchUnlocked('luxury', progress)).toBe(false);
  });

  it('unlocks Records one tier at a time', () => {
    expect(isRecordUnlocked('whiteLp', new Set())).toBe(true);
    expect(isRecordUnlocked('redLp', new Set(['whiteLp']))).toBe(true);
    expect(isRecordUnlocked('greenLp', new Set(['whiteLp']))).toBe(false);
    expect(isRecordUnlocked('greenLp', new Set(['redLp']))).toBe(true);
  });
});
