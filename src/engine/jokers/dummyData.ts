import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const dummyData: JokerDef = {
  id: 'dummyData',
  gddNumber: 51,
  nameKo: '더미 데이터',
  nameEn: 'Dummy Data',
  emoji: '▦',
  rarity: 'rare',
  layer: 1,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    wordRules: ({ ctx }) => {
      ctx.submission.scoringLength =
        (ctx.submission.scoringLength ?? ctx.submission.tiles.length) + BALANCE.jokers.dummyData.length;
    },
  },
};
