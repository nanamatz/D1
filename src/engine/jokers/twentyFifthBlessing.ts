import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const twentyFifthBlessing: JokerDef = {
  id: 'twentyFifthBlessing', gddNumber: 47, nameKo: '25번째 축복', nameEn: '25th Blessing',
  emoji: '💫', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    heldTileScoring: ({ ctx, tile }) => {
      if (tile.letter === 'Y') ctx.mult *= BALANCE.jokers.twentyFifthBlessing.factorPerHeldY;
    },
  },
};
