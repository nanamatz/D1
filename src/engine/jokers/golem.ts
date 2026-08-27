import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const golem: JokerDef = {
  id: 'golem', gddNumber: 55, nameKo: '골렘', nameEn: 'Golem',
  emoji: '🗿', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.material === 'stone') ctx.mult += BALANCE.jokers.golem.multPerStone;
    },
  },
};
