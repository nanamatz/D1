/**
 * Blind skipping and its disclosed publishing-world rewards (GDD §8.2).
 * This module owns the complete reward pool and mutation rules; UI only renders
 * the pre-rolled offer and invokes `skipCurrentBlind`.
 */

import { BALANCE } from './balance';
import { bossPoolForId, drawBossFromCycle } from './bosses';
import { defaultJokerBus } from './jokers';
import type { Rng } from './rng';
import type {
  BlindState,
  NextBlindBonus,
  PackSize,
  PackSlot,
  PackType,
  PatternId,
  PythagoreanPath,
  Letter,
  RunState,
  SkipRewardId,
  SkipRewardOffer,
  WordSubmission,
} from './types';

export const SKIP_REWARD_IDS: readonly SkipRewardId[] = [
  'advancePayment',
  'houseStyle',
  'extraPages',
  'copyPass',
  'quotaRelief',
  'publicity',
  'coverQuote',
  'uncommonTag',
  'rareTag',
  'whiteTag',
  'violetTag',
  'rainbowTag',
  'grayTag',
  'investmentTag',
  'voucherTag',
  'bossTag',
  'tileTag',
  'fableTag',
  'constellationTag',
  'charmTag',
  'handyTag',
  'garbageTag',
  'inkTag',
  'couponTag',
  'jugglerTag',
  'economyTag',
  'alphaOmegaTag',
  'lipogramTag',
  'scarletTag',
  'pythagoreanYTag',
];

/** Rewards whose effect resolves as part of the skip itself, not at a later blind/shop event. */
export const IMMEDIATE_SKIP_REWARD_IDS = [
  'advancePayment',
  'houseStyle',
  'bossTag',
  'tileTag',
  'fableTag',
  'constellationTag',
  'charmTag',
  'handyTag',
  'garbageTag',
  'inkTag',
  'economyTag',
  'pythagoreanYTag',
] as const satisfies readonly SkipRewardId[];

const IMMEDIATE_SKIP_REWARDS = new Set<SkipRewardId>(IMMEDIATE_SKIP_REWARD_IDS);

export function isImmediateSkipReward(id: SkipRewardId): boolean {
  return IMMEDIATE_SKIP_REWARDS.has(id);
}

/** Rewards that remain represented by their Tag until a shop actually consumes them. */
export const NEXT_SHOP_SKIP_REWARD_IDS = [
  'uncommonTag',
  'rareTag',
  'whiteTag',
  'violetTag',
  'rainbowTag',
  'grayTag',
  'voucherTag',
  'couponTag',
] as const satisfies readonly SkipRewardId[];

const NEXT_SHOP_SKIP_REWARDS = new Set<SkipRewardId>(NEXT_SHOP_SKIP_REWARD_IDS);

export function isNextShopSkipReward(id: SkipRewardId): boolean {
  return NEXT_SHOP_SKIP_REWARDS.has(id);
}

export const EMPTY_NEXT_BLIND_BONUS: NextBlindBonus = {
  phases: 0,
  discards: 0,
  handSize: 0,
  targetMultiplier: 1,
  startingScore: 0,
  alphaOmegaReplays: 0,
  lipogramLetters: [],
  scarletLetters: [],
  clearRewardBonus: 0,
};

/** Shared scoring/preview predicate for letter-restriction Tags. */
export function tagDebuffsSubmission(
  blind: BlindState,
  submission: WordSubmission,
): boolean {
  return !submission.isGibberish &&
    (blind.lipogramLetters ?? []).some((letter) =>
      submission.text.toUpperCase().includes(letter));
}

/** Two equally weighted offers without repeating this or the previous Chapter's Tags. */
export function rollSkipOffers(
  run: RunState,
  rng: Rng,
  previous: readonly SkipRewardOffer[] = [],
): [SkipRewardOffer, SkipRewardOffer] {
  const patterns = Object.keys(run.patternLevels) as PatternId[];
  const letters = Object.keys(BALANCE.letterChips) as Letter[];
  const roll = (ids: readonly SkipRewardId[]): SkipRewardOffer => {
    const id = ids[rng.int(ids.length)]!;
    if (id === 'houseStyle') return { id, pattern: patterns[rng.int(patterns.length)]! };
    if (id === 'lipogramTag' || id === 'scarletTag') {
      return { id, letter: letters[rng.int(letters.length)]! };
    }
    return { id };
  };
  const previousIds = new Set(previous.map((offer) => offer.id));
  const pool = SKIP_REWARD_IDS.filter((id) => !previousIds.has(id));
  const first = roll(pool);
  return [first, roll(pool.filter((id) => id !== first.id))];
}

function withBlindBonus(
  run: RunState,
  bonus: Partial<Omit<NextBlindBonus, 'targetMultiplier'>> & { targetMultiplier?: number },
): RunState {
  return {
    ...run,
    nextBlindBonus: {
      phases: run.nextBlindBonus.phases + (bonus.phases ?? 0),
      discards: run.nextBlindBonus.discards + (bonus.discards ?? 0),
      handSize: run.nextBlindBonus.handSize + (bonus.handSize ?? 0),
      targetMultiplier:
        run.nextBlindBonus.targetMultiplier * (bonus.targetMultiplier ?? 1),
      startingScore: run.nextBlindBonus.startingScore + (bonus.startingScore ?? 0),
      alphaOmegaReplays:
        (run.nextBlindBonus.alphaOmegaReplays ?? 0) + (bonus.alphaOmegaReplays ?? 0),
      lipogramLetters: [
        ...(run.nextBlindBonus.lipogramLetters ?? []),
        ...(bonus.lipogramLetters ?? []),
      ],
      scarletLetters: [
        ...(run.nextBlindBonus.scarletLetters ?? []),
        ...(bonus.scarletLetters ?? []),
      ],
      clearRewardBonus:
        (run.nextBlindBonus.clearRewardBonus ?? 0) + (bonus.clearRewardBonus ?? 0),
    },
  };
}

function freePack(
  type: PackType,
  size: PackSize,
  rng: Rng,
): PackSlot {
  return {
    type,
    size,
    free: true,
    artVariant: rng.int(BALANCE.pack.artVariants[type][size]),
  };
}

/** Live payout used by Handy/Garbage tags at both disclosure and application. */
export function skipRewardLiveAmount(run: RunState, id: SkipRewardId): number | null {
  if (id === 'handyTag') {
    return run.counters.totalWords * BALANCE.skipRewards.handyGoldPerHand;
  }
  if (id === 'garbageTag') {
    return (run.counters.unusedDiscards ?? 0) * BALANCE.skipRewards.garbageGoldPerDiscard;
  }
  return null;
}

export interface SkipRewardResult {
  run: RunState;
  /** Pack tags open this seeded pack immediately before the next blind is prepared. */
  freePack?: PackSlot;
}

/** Apply the current offer and advance to the next blind without payout or shop. */
export function skipCurrentBlind(
  run: RunState,
  rng: Rng,
  options: { pythagoreanPath?: PythagoreanPath } = {},
): SkipRewardResult {
  if (run.blindIndex === 2) throw new Error('Deadline cannot be skipped');
  const skippedIndex = run.blindIndex;
  const offer = run.skipOffers[skippedIndex];
  if (!offer) throw new Error(`missing skip reward for blind ${skippedIndex}`);

  let next = run;
  let awardedPack: PackSlot | undefined;
  switch (offer.id) {
    case 'advancePayment':
      next = { ...next, gold: next.gold + BALANCE.skipRewards.advanceGold };
      break;
    case 'houseStyle': {
      const pattern = offer.pattern;
      if (!pattern) throw new Error('House Style offer is missing its disclosed pattern');
      next = {
        ...next,
        patternLevels: {
          ...next.patternLevels,
          [pattern]: next.patternLevels[pattern] + BALANCE.skipRewards.patternLevels,
        },
      };
      break;
    }
    case 'extraPages':
      next = withBlindBonus(next, { phases: BALANCE.skipRewards.phases });
      break;
    case 'copyPass':
      next = withBlindBonus(next, { discards: BALANCE.skipRewards.discards });
      break;
    case 'quotaRelief':
      next = withBlindBonus(next, { targetMultiplier: BALANCE.skipRewards.targetMultiplier });
      break;
    case 'publicity':
      next = {
        ...next,
        pendingClearReward: next.pendingClearReward + BALANCE.skipRewards.clearReward,
      };
      break;
    case 'coverQuote':
      next = withBlindBonus(next, { startingScore: BALANCE.skipRewards.startingScore });
      break;
    case 'uncommonTag':
    case 'rareTag':
    case 'whiteTag':
    case 'violetTag':
    case 'rainbowTag':
    case 'grayTag':
    case 'voucherTag':
    case 'couponTag':
      next = {
        ...next,
        pendingShopTags: [...(next.pendingShopTags ?? []), offer.id],
      };
      break;
    case 'investmentTag':
      next = {
        ...next,
        pendingBossReward:
          (next.pendingBossReward ?? 0) + BALANCE.skipRewards.investmentReward,
      };
      break;
    case 'bossTag': {
      const bossDraw = drawBossFromCycle(
        rng,
        bossPoolForId(next.chapterBossId),
        next.bossHistory,
        next.chapterBossId,
      );
      next = {
        ...next,
        chapterBossId: bossDraw.bossId,
        bossHistory: bossDraw.history,
      };
      break;
    }
    case 'tileTag':
      awardedPack = freePack('tile', 'mega', rng);
      break;
    case 'fableTag':
      awardedPack = freePack('consumable', 'mega', rng);
      break;
    case 'constellationTag':
      awardedPack = freePack('pattern', 'mega', rng);
      break;
    case 'charmTag':
      awardedPack = freePack('joker', 'mega', rng);
      break;
    case 'inkTag':
      awardedPack = freePack('ink', 'normal', rng);
      break;
    case 'handyTag':
    case 'garbageTag':
      next = {
        ...next,
        gold: next.gold + (skipRewardLiveAmount(next, offer.id) ?? 0),
      };
      break;
    case 'jugglerTag':
      next = withBlindBonus(next, { handSize: BALANCE.skipRewards.jugglerHandSize });
      break;
    case 'economyTag':
      next = {
        ...next,
        gold: next.gold * BALANCE.skipRewards.economyGoldMultiplier,
      };
      break;
    case 'alphaOmegaTag':
      next = withBlindBonus(next, { alphaOmegaReplays: 1 });
      break;
    case 'lipogramTag':
      if (!offer.letter) throw new Error('Lipogram Tag offer is missing its disclosed letter');
      next = withBlindBonus(next, {
        targetMultiplier: BALANCE.skipRewards.lipogramTargetMultiplier,
        lipogramLetters: [offer.letter],
      });
      break;
    case 'scarletTag':
      if (!offer.letter) throw new Error('Scarlet Tag offer is missing its disclosed letter');
      next = withBlindBonus(next, { scarletLetters: [offer.letter] });
      break;
    case 'pythagoreanYTag':
      if (!options.pythagoreanPath) {
        throw new Error('Y Tag requires a disclosed path choice');
      }
      next = options.pythagoreanPath === 'wide'
        ? withBlindBonus(next, {
            targetMultiplier: BALANCE.skipRewards.pythagoreanWideTargetMultiplier,
          })
        : withBlindBonus(next, {
            targetMultiplier: BALANCE.skipRewards.pythagoreanNarrowTargetMultiplier,
            clearRewardBonus: BALANCE.skipRewards.pythagoreanNarrowReward,
          });
      break;
  }

  const advanced: RunState = {
    ...next,
    blindIndex: (skippedIndex + 1) as 1 | 2,
    skippedThisChapter: [...next.skippedThisChapter, skippedIndex],
    skippedBlinds: next.skippedBlinds + 1,
    jokers: next.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  defaultJokerBus.emit('blindSkipped', { run: advanced }, advanced.jokers);
  return awardedPack ? { run: advanced, freePack: awardedPack } : { run: advanced };
}

/** Called only when the player commits to Play, never while merely previewing. */
export function consumeNextBlindBonus(run: RunState): RunState {
  return { ...run, nextBlindBonus: { ...EMPTY_NEXT_BLIND_BONUS } };
}
