import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { jokerSlotLimit } from '../vouchers';

export const bookOfMargins: JokerDef = {
  id: 'bookOfMargins',
  gddNumber: 1,
  nameKo: '여백의 서',
  nameEn: 'Book of Margins',
  emoji: '🕳️',
  rarity: 'legendary',
  layer: 3,
  price: BALANCE.jokerPrice.legendary,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }) => {
      const empty = Math.max(0, jokerSlotLimit(run) - run.jokers.length);
      ctx.mult *= Math.pow(BALANCE.jokers.bookOfMargins.factorPerEmptySlot, empty);
    },
  },
};
