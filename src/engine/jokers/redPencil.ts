import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const redPencil: JokerDef = {
  id: 'redPencil', gddNumber: 12, nameKo: '빨간 연필', nameEn: 'Red Pencil',
  emoji: '✏️', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (!ctx.submission.isGibberish) ctx.chips += BALANCE.jokers.redPencil.chips;
    },
  },
};
