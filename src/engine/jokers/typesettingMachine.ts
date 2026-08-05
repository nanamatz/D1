import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const typesettingMachine: JokerDef = {
  id: 'typesettingMachine', gddNumber: 36, nameKo: '조판 기계', nameEn: 'Typesetting Machine',
  emoji: '⌨️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.font !== 'medium') ctx.mult *= BALANCE.jokers.typesettingMachine.factorPerTile;
    },
  },
};
