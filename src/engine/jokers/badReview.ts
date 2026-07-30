import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const badReview: JokerDef = {
  id: 'badReview', gddNumber: 37, nameKo: '악평', nameEn: 'Bad Review',
  emoji: '🍅', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (!ctx.submission.isGibberish) return;
      ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.badReview.gold;
      ctx.mult = Math.max(
        BALANCE.jokers.badReview.minMult,
        ctx.mult - BALANCE.jokers.badReview.multPenalty,
      );
    },
  },
};
