import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const pageNumber: JokerDef = {
  scoresGibberish: true,
  id: 'pageNumber', gddNumber: 19, nameKo: '페이지 번호', nameEn: 'Page Number',
  emoji: '🔢', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if ((blind.phasesUsed + 1) % 2 === 0) ctx.mult += BALANCE.jokers.pageNumber.mult;
    },
  },
};
