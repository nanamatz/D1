import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const dadaist: JokerDef = {
  id: 'dadaist',
  gddNumber: 9,
  nameKo: '다다이스트',
  nameEn: 'Dadaist',
  emoji: '🫧',
  rarity: 'rare',
  layer: 2,
  price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  scoresGibberish: true,
  hooks: {
    wordRules: ({ ctx }) => {
      if (ctx.submission.isGibberish) ctx.scoringSuits = new Set(['slang']);
    },
    wordScoring: ({ ctx }) => {
      if (ctx.submission.isGibberish) ctx.mult *= BALANCE.jokers.dadaist.factor;
    },
  },
};
