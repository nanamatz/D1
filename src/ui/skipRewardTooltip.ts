import { BALANCE } from '../engine/balance';
import { skipRewardLiveAmount } from '../engine/skipRewards';
import type { RunState, SkipRewardId, SkipRewardOffer } from '../engine/types';

const COLLECTION_DESC_KEYS: Partial<Record<SkipRewardId, string>> = {
  houseStyle: 'skipReward.houseStyle.collectionDesc',
  handyTag: 'skipReward.handyTag.collectionDesc',
  garbageTag: 'skipReward.garbageTag.collectionDesc',
};

/** Collection has no live offer/run, so contextual rewards use truthful generic copy. */
export function skipRewardCollectionDescKey(id: SkipRewardId): string {
  return COLLECTION_DESC_KEYS[id] ?? `skipReward.${id}.desc`;
}

/** Shared interpolation values for Blind Select and Collection tag tooltips. */
export function skipRewardParams(
  offer: SkipRewardOffer,
  run?: RunState,
  patternName = '',
): Record<string, string | number> {
  return {
    pattern: patternName,
    gold: BALANCE.skipRewards.advanceGold,
    levels: BALANCE.skipRewards.patternLevels,
    phases: BALANCE.skipRewards.phases,
    discards: BALANCE.skipRewards.discards,
    handSize: offer.id === 'jugglerTag'
      ? BALANCE.skipRewards.jugglerHandSize
      : BALANCE.skipRewards.handSize,
    percent: Math.round((1 - BALANCE.skipRewards.targetMultiplier) * 100),
    reward: offer.id === 'investmentTag'
      ? BALANCE.skipRewards.investmentReward
      : BALANCE.skipRewards.clearReward,
    score: BALANCE.skipRewards.startingScore,
    current: run ? (skipRewardLiveAmount(run, offer.id) ?? 0) : 0,
  };
}
