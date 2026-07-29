import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C8 (GDD §11.2) — +Mult on short words, layer 1. */
export const shortAndSharp: JokerDef = {
  id: 'shortAndSharp',
  gddNumber: 8,
  nameKo: '짧고 굵게',
  nameEn: 'Short & Sharp',
  emoji: '🗡️',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const { maxLength, mult } = BALANCE.jokers.shortAndSharp;
      if (ctx.submission.tiles.length <= maxLength) ctx.mult += mult;
    },
  },
};
