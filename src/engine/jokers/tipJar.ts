import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const tipJar: JokerDef = {
  id: 'tipJar', gddNumber: 21, nameKo: '잔돈 통', nameEn: 'Tip Jar',
  emoji: '🫙', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (!ctx.submission.isGibberish &&
          !blind.sequence.some((word) => !word.isGibberish && !word.debuffed)) {
        ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.tipJar.gold;
      }
    },
  },
};
