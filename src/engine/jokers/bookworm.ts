import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bookworm: JokerDef = {
  id: 'bookworm', gddNumber: 24, nameKo: '책벌레', nameEn: 'Bookworm',
  emoji: '🐛', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      ctx.chips += (blind.sequence.length + 1) * BALANCE.jokers.bookworm.chipsPerWord;
    },
  },
};
