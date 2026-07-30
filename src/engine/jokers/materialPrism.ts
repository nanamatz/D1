import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const materialPrism: JokerDef = {
  id: 'materialPrism', gddNumber: 22, nameKo: '사질 프리즘', nameEn: 'Material Prism',
  emoji: '🔶', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ ctx }) => {
      const count = new Set(ctx.submission.tiles.map((tile) => tile.material)).size;
      ctx.mult *= BALANCE.jokers.materialPrism.factorPerMaterial ** count;
    },
  },
};
