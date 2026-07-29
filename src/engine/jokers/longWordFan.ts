import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C7 (GDD §11.2) — +Chips on long words, layer 1. */
export const longWordFan: JokerDef = {
  id: 'longWordFan',
  gddNumber: 7,
  nameKo: '장문 애호가',
  nameEn: 'Long-Word Fan',
  emoji: '📏',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const { minLength, chips } = BALANCE.jokers.longWordFan;
      if (ctx.submission.tiles.length >= minLength) ctx.chips += chips;
    },
  },
};
