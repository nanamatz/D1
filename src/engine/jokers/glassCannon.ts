import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const glassCannon: JokerDef = {
  id: 'glassCannon', gddNumber: 19, nameKo: '유리 대포', nameEn: 'Glass Cannon',
  emoji: '💥', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ ctx }) => {
      const count = ctx.submission.tiles.filter((tile) => tile.material === 'glass').length;
      ctx.mult *= BALANCE.jokers.glassCannon.factorPerGlass ** count;
    },
  },
};
