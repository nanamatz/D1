import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const woodpecker: JokerDef = {
  id: 'woodpecker', gddNumber: 28, nameKo: '딱따구리', nameEn: 'Woodpecker',
  emoji: '🐦', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.material === 'wood') ctx.chips += BALANCE.jokers.woodpecker.chipsPerWood;
    },
  },
};
