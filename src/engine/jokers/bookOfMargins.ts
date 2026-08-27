import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { jokerSlotLimit } from '../vouchers';

export const bookOfMargins: JokerDef = {
  scoresGibberish: true,
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
    wordScoring: ({ run, ctx, scoreBeats }) => {
      const empty = Math.max(0, jokerSlotLimit(run) - run.jokers.length);
      for (let index = 0; index < empty; index += 1) {
        ctx.mult *= BALANCE.jokers.bookOfMargins.factorPerEmptySlot;
        scoreBeats?.push({
          chipsDelta: 0, multDelta: 0,
          multFactor: BALANCE.jokers.bookOfMargins.factorPerEmptySlot,
        });
      }
    },
  },
};
