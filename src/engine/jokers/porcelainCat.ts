import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const porcelainCat: JokerDef = {
  id: 'porcelainCat', gddNumber: 27, nameKo: '자기 고양이', nameEn: 'Porcelain Cat',
  emoji: '🐈', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (ctx.submission.tiles.some((tile) => tile.material === 'porcelain')) {
        ctx.mult += BALANCE.jokers.porcelainCat.mult;
      }
    },
  },
};
