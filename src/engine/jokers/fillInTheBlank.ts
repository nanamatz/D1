import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const fillInTheBlank: JokerDef = {
  id: 'fillInTheBlank', gddNumber: 16, nameKo: '빈칸 채우기', nameEn: 'Fill in the Blank',
  emoji: '❓', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  scoresGibberish: true,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (ctx.submission.isGibberish) ctx.chips += BALANCE.jokers.fillInTheBlank.chips;
    },
  },
};
