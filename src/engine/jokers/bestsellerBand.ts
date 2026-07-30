import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bestsellerBand: JokerDef = {
  id: 'bestsellerBand', gddNumber: 36, nameKo: '베스트셀러 띠지', nameEn: 'Bestseller Band',
  emoji: '🏅', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (
        !ctx.submission.isGibberish &&
        ctx.submission.tiles.length >= BALANCE.jokers.bestsellerBand.minLength
      ) ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.bestsellerBand.gold;
    },
  },
};
