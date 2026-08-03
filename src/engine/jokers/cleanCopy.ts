import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const cleanCopy: JokerDef = {
  id: 'cleanCopy', gddNumber: 30, nameKo: '깨끗한 원고', nameEn: 'Clean Copy',
  emoji: '📄', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.discardsLeft >= BALANCE.jokers.cleanCopy.minDiscardsLeft) {
        ctx.mult += BALANCE.jokers.cleanCopy.mult;
      }
    },
  },
};
