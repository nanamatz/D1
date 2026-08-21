import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { ALL_JOKERS, createOwnedJoker, JOKER_REGISTRY } from '../src/engine/jokers';
import { startBlind, submitWord } from '../src/engine/loop';
import { makeLexicon } from '../src/engine/lexicon';
import { resolveBlind } from '../src/engine/progression';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import {
  applyPendingShopTags,
  buyVoucher,
  prepareShop,
  rerollShop,
} from '../src/engine/shop';
import {
  skipCurrentBlind,
  skipRewardLiveAmount,
} from '../src/engine/skipRewards';
import type {
  JokerEdition,
  JokerRarity,
  Letter,
  PackSize,
  PackType,
  RunState,
  ShopState,
  SkipRewardId,
  Tile,
} from '../src/engine/types';

const withDraftTag = (id: SkipRewardId, over: Partial<RunState> = {}): RunState => ({
  ...newRun(`tag-${id}`),
  ...over,
  blindIndex: 0,
  skipOffers: [{ id }, { id: 'advancePayment' }],
});

const emptyShop = (over: Partial<ShopState> = {}): ShopState => ({
  items: [],
  voucher: null,
  bonusVoucher: null,
  packs: [],
  rerolls: 0,
  ...over,
});

describe('new blind-skip tags: immediate and blind-delayed effects', () => {
  it.each([
    ['tileTag', 'tile', 'mega'],
    ['fableTag', 'consumable', 'mega'],
    ['constellationTag', 'pattern', 'mega'],
    ['charmTag', 'joker', 'mega'],
    ['inkTag', 'ink', 'normal'],
  ] as const)('%s returns its free pack immediately', (id, type, size) => {
    const result = skipCurrentBlind(withDraftTag(id), makeRng(`pack-${id}`));

    expect(result.freePack).toMatchObject({ type, size, free: true });
    expect(result.freePack!.artVariant).toBeGreaterThanOrEqual(0);
    expect(result.freePack!.artVariant).toBeLessThan(
      BALANCE.pack.artVariants[type as PackType][size as PackSize],
    );
  });

  it('rerolls the scheduled boss deterministically within the same boss pool', () => {
    const run = withDraftTag('bossTag', { chapterBossId: 'wanted' });
    const a = skipCurrentBlind(run, makeRng('boss-tag')).run;
    const b = skipCurrentBlind(run, makeRng('boss-tag')).run;

    expect(a.chapterBossId).toBe(b.chapterBossId);
    expect(a.chapterBossId).not.toBe('wanted');
    expect(a.bossHistory).toEqual(expect.arrayContaining(['wanted', a.chapterBossId]));
  });

  it('uses the live run counters for Handy and Garbage payouts', () => {
    const counters = {
      ...newRun('tag-counters').counters,
      totalWords: 7,
      unusedDiscards: 4,
    };
    const handy = withDraftTag('handyTag', { gold: 10, counters });
    const garbage = withDraftTag('garbageTag', { gold: 10, counters });

    expect(skipRewardLiveAmount(handy, 'handyTag')).toBe(7);
    expect(skipRewardLiveAmount(garbage, 'garbageTag')).toBe(4);
    expect(skipCurrentBlind(handy, makeRng('handy')).run.gold).toBe(17);
    expect(skipCurrentBlind(garbage, makeRng('garbage')).run.gold).toBe(14);
  });

  it('stacks Investment until a Deadline clear and tracks unused discards', () => {
    const invested = skipCurrentBlind(
      withDraftTag('investmentTag', { pendingBossReward: 5 }),
      makeRng('investment'),
    ).run;
    expect(invested.pendingBossReward).toBe(5 + BALANCE.skipRewards.investmentReward);

    const revisionRun = { ...invested, blindIndex: 1 as const };
    const revisionBlind = {
      ...startBlind(revisionRun, makeRng('revision-clear'), { kind: 'big', target: 1 }),
      discardsLeft: 2,
    };
    const afterRevision = resolveBlind(revisionRun, revisionBlind, 1);
    expect(afterRevision.run.pendingBossReward).toBe(invested.pendingBossReward);
    expect(afterRevision.run.counters.unusedDiscards).toBe(2);

    const bossRun = { ...afterRevision.run, blindIndex: 2 as const };
    const bossBlind = {
      ...startBlind(bossRun, makeRng('boss-clear'), {
        kind: 'boss',
        bossId: 'wanted',
        target: 1,
      }),
      discardsLeft: 3,
    };
    const baselineReward = resolveBlind(
      { ...bossRun, pendingBossReward: 0 },
      bossBlind,
      bossBlind.target,
    ).earned.reward;
    const afterBoss = resolveBlind(bossRun, bossBlind, bossBlind.target);

    expect(afterBoss.earned.reward).toBe(baselineReward + invested.pendingBossReward);
    expect(afterBoss.earned.tagReward).toBe(invested.pendingBossReward);
    expect(afterBoss.run.pendingBossReward).toBe(0);
    expect(afterBoss.run.counters.unusedDiscards).toBe(5);
  });

  it('applies Juggler +2 to the next played blind', () => {
    expect(BALANCE.skipRewards.jugglerHandSize).toBe(2);
    const juggler = skipCurrentBlind(withDraftTag('jugglerTag'), makeRng('juggler')).run;

    expect(juggler.nextBlindBonus.handSize).toBe(BALANCE.skipRewards.jugglerHandSize);
  });

  it.each([
    [0, 0], [1, 2], [24, 48], [25, 50], [26, 51], [100, 125],
  ])('Economy gains current Fee with a $25 cap: $%i -> $%i', (gold, expected) => {
    const economy = skipCurrentBlind(
      withDraftTag('economyTag', { gold }),
      makeRng(`economy-${gold}`),
    ).run;
    expect(economy.gold).toBe(expected);
  });

  it('Supply creates up to two eligible Base Common Emoji Tiles within capacity', () => {
    const commonIds = ALL_JOKERS.filter((def) => def.rarity === 'common')
      .slice(0, 3)
      .map((def) => def.id);
    const profileEligible = new Set(commonIds);
    const supplied = skipCurrentBlind(
      withDraftTag('pythagoreanYTag'),
      makeRng('supply-two'),
      { profileEligible },
    ).run;
    expect(supplied.jokers).toHaveLength(2);
    expect(new Set(supplied.jokers.map((joker) => joker.defId)).size).toBe(2);
    expect(supplied.jokers.every((joker) =>
      profileEligible.has(joker.defId) && joker.edition === 'base')).toBe(true);

    const oneSlot = skipCurrentBlind(
      withDraftTag('pythagoreanYTag', { jokerSlots: 1 }),
      makeRng('supply-one'),
      { profileEligible },
    ).run;
    expect(oneSlot.jokers).toHaveLength(1);

    const noSlots = skipCurrentBlind(
      withDraftTag('pythagoreanYTag', { jokerSlots: 0 }),
      makeRng('supply-none'),
      { profileEligible },
    ).run;
    expect(noSlots.jokers).toHaveLength(0);
  });

  it('Supply never copies an already owned Common, even with Copy Editor', () => {
    const base = withDraftTag('pythagoreanYTag');
    const commonId = ALL_JOKERS.find((def) => def.rarity === 'common')!.id;
    const run = {
      ...base,
      jokers: [
        createOwnedJoker(base, 'copyEditor'),
        createOwnedJoker(base, commonId),
      ],
    };
    const supplied = skipCurrentBlind(
      run,
      makeRng('supply-unowned-only'),
      { profileEligible: new Set([commonId]) },
    ).run;

    expect(supplied.jokers.filter((joker) => joker.defId === commonId)).toHaveLength(1);
  });
});

describe('new blind-skip tags: next-shop effects', () => {
  it('Reroll Tag starts the next shop progression at $0, then $1, then $2', () => {
    const run = withDraftTag('alphaOmegaTag', {
      gold: 10,
      pendingShopTags: ['alphaOmegaTag'],
    });
    const prepared = applyPendingShopTags(run, emptyShop(), makeRng('reroll-tag-entry'));
    expect(prepared.appliedTags).toEqual(['alphaOmegaTag']);
    expect(prepared.run.pendingShopTags).toEqual([]);
    expect(prepared.shop.rerollBase).toBe(0);

    const first = rerollShop(prepared.run, prepared.shop, makeRng('reroll-tag-0'));
    const second = rerollShop(first.run, first.shop, makeRng('reroll-tag-1'));
    const third = rerollShop(second.run, second.shop, makeRng('reroll-tag-2'));
    expect([first.ok, second.ok, third.ok]).toEqual([true, true, true]);
    expect([first.run.gold, second.run.gold, third.run.gold]).toEqual([10, 9, 7]);
  });

  it('applies the Reroll Tag base before voucher discount and keeps the $0 floor', () => {
    const run = withDraftTag('alphaOmegaTag', {
      gold: 10,
      vouchers: ['fashionBook'],
      pendingShopTags: ['alphaOmegaTag'],
    });
    const prepared = applyPendingShopTags(run, emptyShop(), makeRng('reroll-tag-voucher-entry'));
    expect(prepared.shop.rerollBase).toBe(BALANCE.skipRewards.rerollStartCost);

    const results = [];
    let current = { run: prepared.run, shop: prepared.shop };
    for (let index = 0; index < 5; index += 1) {
      const result = rerollShop(current.run, current.shop, makeRng(`reroll-tag-voucher-${index}`));
      expect(result.ok).toBe(true);
      results.push(result.run.gold);
      current = result;
    }
    expect(results).toEqual([10, 10, 10, 9, 7]);
  });

  it.each([
    ['uncommonTag', 'uncommon'],
    ['rareTag', 'rare'],
  ] as const)('%s adds a free %s Emoji Tile', (tag, rarity) => {
    const run = withDraftTag(tag, { pendingShopTags: [tag] });
    const prepared = applyPendingShopTags(run, emptyShop(), makeRng(`shop-${tag}`));
    const offered = prepared.shop.items.find(
      (item) => item?.kind === 'joker' && item.price === 0,
    );

    expect(offered?.kind).toBe('joker');
    if (!offered || offered.kind !== 'joker') throw new Error('missing tagged Emoji Tile');
    expect(JOKER_REGISTRY.get(offered.id)?.rarity).toBe(rarity as JokerRarity);
    expect(prepared.run.pendingShopTags).toEqual([]);
    expect(prepared.appliedTags).toEqual([tag]);
  });

  it('keeps appended rarity-tag offers while rerolling ordinary stock', () => {
    const run = withDraftTag('uncommonTag', {
      gold: 99,
      pendingShopTags: ['uncommonTag', 'rareTag'],
    });
    const prepared = applyPendingShopTags(
      run,
      emptyShop({ items: [{ kind: 'consumable', id: 'magnifier', price: 3 }] }),
      makeRng('rarity-tags-stock'),
    );
    const tagged = prepared.shop.items.filter(
      (item) => item?.kind === 'joker' && item.rarityTag !== undefined,
    );
    const rerolled = rerollShop(
      prepared.run,
      prepared.shop,
      makeRng('rarity-tags-reroll'),
    );

    expect(rerolled.ok).toBe(true);
    expect(rerolled.shop.items.slice(-tagged.length)).toEqual(tagged);
    expect(rerolled.shop.items.slice(0, -tagged.length)).not.toEqual(
      prepared.shop.items.slice(0, -tagged.length),
    );
  });

  it.each([
    ['whiteTag', 'white'],
    ['violetTag', 'violet'],
    ['rainbowTag', 'rainbow'],
    ['grayTag', 'gray'],
  ] as const)('%s makes the next base-edition shop Emoji Tile free and %s', (tag, edition) => {
    const run = withDraftTag(tag, { pendingShopTags: [tag] });
    const shop = emptyShop({
      items: [{ kind: 'joker', id: 'hypocrite', edition: 'base', price: 9 }],
    });
    const prepared = applyPendingShopTags(run, shop, makeRng(`shop-${tag}`));

    expect(prepared.shop.items[0]).toMatchObject({
      kind: 'joker',
      edition: edition as JokerEdition,
      price: 0,
    });
    expect(prepared.run.pendingShopTags).toEqual([]);
    expect(prepared.appliedTags).toEqual([tag]);
  });

  it('keeps an edition tag pending when the shop has no base-edition Emoji Tile', () => {
    const run = withDraftTag('whiteTag', { pendingShopTags: ['whiteTag'] });
    const prepared = applyPendingShopTags(run, emptyShop(), makeRng('edition-waits'));

    expect(prepared.run.pendingShopTags).toEqual(['whiteTag']);
    expect(prepared.appliedTags).toEqual([]);
  });

  it.each(['base', 'bonus'] as const)(
    'lets Voucher Tag buy both choices when the %s choice is bought first',
    (firstSlot) => {
      const run = withDraftTag('voucherTag', {
        gold: 99,
        voucherOffer: 'memo',
        pendingShopTags: ['voucherTag'],
      });
      const prepared = prepareShop(run, makeRng('voucher-tag'));

      expect(prepared.shop.voucher).toBe('memo');
      expect(prepared.shop.bonusVoucher).not.toBeNull();
      expect(prepared.shop.bonusVoucher).not.toBe(prepared.shop.voucher);
      expect(prepared.appliedTags).toEqual(['voucherTag']);
      const offered = [prepared.shop.voucher, prepared.shop.bonusVoucher];

      const first = buyVoucher(prepared.run, prepared.shop, firstSlot);
      expect(first.ok).toBe(true);
      expect(first.run.voucherLocked).toBe(true);
      expect(first.shop.voucher).toBeNull();
      expect(first.shop.bonusVoucher).not.toBeNull();

      const second = buyVoucher(first.run, first.shop, 'bonus');
      expect(second.ok).toBe(true);
      expect(second.shop.voucher).toBeNull();
      expect(second.shop.bonusVoucher).toBeNull();
      expect(second.run.vouchers).toEqual(expect.arrayContaining(offered));
      expect(buyVoucher(second.run, prepared.shop, 'base').ok).toBe(false);
    },
  );

  it('keeps Voucher Tag pending until a shop where its choice can be purchased', () => {
    const run = withDraftTag('voucherTag', {
      voucherLocked: true,
      pendingShopTags: ['voucherTag'],
    });
    const lockedShop = prepareShop(run, makeRng('locked-voucher-tag'));

    expect(lockedShop.shop.voucher).toBeNull();
    expect(lockedShop.shop.bonusVoucher).toBeNull();
    expect(lockedShop.run.pendingShopTags).toEqual(['voucherTag']);
    expect(lockedShop.appliedTags).toEqual([]);

    const availableShop = prepareShop(
      { ...lockedShop.run, voucherLocked: false, voucherOffer: 'memo' },
      makeRng('available-voucher-tag'),
    );
    expect(availableShop.shop.bonusVoucher).not.toBeNull();
    expect(availableShop.shop.bonusVoucher).not.toBe('memo');
    expect(availableShop.run.pendingShopTags).toEqual([]);
    expect(availableShop.appliedTags).toEqual(['voucherTag']);
  });

  it('makes every initially stocked item and pack free with Coupon Tag', () => {
    const run = withDraftTag('couponTag', { pendingShopTags: ['couponTag'] });
    const shop = emptyShop({
      items: [
        { kind: 'joker', id: 'hypocrite', edition: 'base', price: 9 },
        { kind: 'consumable', id: 'magnifier', price: 3 },
      ],
      packs: [
        { type: 'joker', size: 'normal', artVariant: 0 },
        { type: 'tile', size: 'mega', artVariant: 0 },
      ],
    });
    const prepared = applyPendingShopTags(run, shop, makeRng('coupon-tag'));

    expect(prepared.shop.items.map((item) => item?.price)).toEqual([0, 0]);
    expect(prepared.shop.packs.map((pack) => pack?.free)).toEqual([true, true]);
    expect(prepared.run.pendingShopTags).toEqual([]);
    expect(prepared.appliedTags).toEqual(['couponTag']);
  });
});

describe('run counters used by live-value tags', () => {
  let nextTile = 0;
  const tile = (letter: Letter): Tile => ({
    id: `tag-counter-${nextTile++}`,
    letter,
    material: 'ceramic',
    font: 'medium',
  });

  it('returns an incremented totalWords counter after each submission', () => {
    const run = newRun('tag-word-counter');
    const blind = startBlind(run, makeRng('tag-word-counter'));
    const controlled = {
      ...blind,
      hand: [tile('C'), tile('A'), tile('T'), ...blind.hand.slice(3)],
    };
    const result = submitWord(
      controlled,
      run,
      makeLexicon(['cat'], {}),
      controlled.hand.slice(0, 3).map((entry) => entry.id),
      makeRng('tag-word-submit'),
    );

    expect(result.counters.totalWords).toBe(run.counters.totalWords + 1);
    expect(result.playedWords).toEqual(['cat']);
    expect(run.counters.totalWords).toBe(0);
  });
});
