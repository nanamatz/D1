import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const glassCannon: JokerDef = {
  id: 'glassCannon', gddNumber: 19, nameKo: '유리 대포', nameEn: 'Glass Cannon',
  emoji: '💥', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.material === 'glass') ctx.mult *= BALANCE.jokers.glassCannon.factorPerGlass;
    },
  },
};
