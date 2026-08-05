import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const materialPrism: JokerDef = {
  id: 'materialPrism', gddNumber: 22, nameKo: '사질 프리즘', nameEn: 'Material Prism',
  emoji: '🔶', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (ctx.submission.tiles.find((candidate) => candidate.material === tile.material)?.id === tile.id) {
        ctx.mult *= BALANCE.jokers.materialPrism.factorPerMaterial;
      }
    },
  },
};
