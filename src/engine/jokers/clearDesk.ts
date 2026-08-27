import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const clearDesk: JokerDef = {
  scoresGibberish: true,
  id: 'clearDesk', gddNumber: 32, nameKo: '빈 책상', nameEn: 'Clear Desk',
  emoji: '🛋️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (ctx.submission.tiles.length === blind.hand.length) ctx.mult += BALANCE.jokers.clearDesk.mult;
    },
  },
};
