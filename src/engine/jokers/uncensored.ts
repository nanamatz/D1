import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const uncensored: JokerDef = {
  id: 'uncensored', gddNumber: 15, nameKo: '검열 해제', nameEn: 'Uncensored',
  emoji: '🚫', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordChecked: ({ ctx, debuffed }) => {
      if (ctx.submission.suit === 'vulgar' && !debuffed) ctx.chips += BALANCE.jokers.uncensored.chips;
    },
  },
};
