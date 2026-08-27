import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const uncensored: JokerDef = {
  id: 'uncensored', gddNumber: 15, nameKo: '검열 해제', nameEn: 'Uncensored',
  emoji: '🚫', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    debuffScoring: ({ ctx }) => {
      if (!ctx.submission.isGibberish) {
        ctx.chips += BALANCE.jokers.uncensored.chips;
        ctx.mult = 1;
      }
    },
  },
};
