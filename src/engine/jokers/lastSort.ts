import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const lastSort: JokerDef = {
  id: 'lastSort', gddNumber: 33, nameKo: '마지막 활자', nameEn: 'Last Sort',
  emoji: '🔚', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.bag.length === 0) ctx.chips += BALANCE.jokers.lastSort.chips;
    },
  },
};
