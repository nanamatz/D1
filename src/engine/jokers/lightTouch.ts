import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const lightTouch: JokerDef = {
  id: 'lightTouch', gddNumber: 23, nameKo: '가벼운 손길', nameEn: 'Light Touch',
  emoji: '🪶', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.font === 'lightItalic') {
        ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.lightTouch.goldPerTile;
      }
    },
  },
};
