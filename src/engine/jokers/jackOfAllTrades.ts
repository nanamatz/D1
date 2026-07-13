/** #10 Jack of All Trades (Common, layer 1): unconditional +4 Mult.
 *  The baseline joker — always on, the early foundation (GDD §11.1). */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const jackOfAllTrades: JokerDef = {
  id: 'jackOfAllTrades',
  gddNumber: 10,
  nameKo: '만물박사',
  nameEn: 'Jack of All Trades',
  emoji: '🃏',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      ctx.mult += BALANCE.jokers.jackOfAllTrades.mult;
    },
  },
};
