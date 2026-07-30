import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const heavyPress: JokerDef = {
  id: 'heavyPress', gddNumber: 24, nameKo: '중압 인쇄', nameEn: 'Heavy Press',
  emoji: '🏋️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.font === 'bold') ctx.chips += BALANCE.jokers.heavyPress.chipsPerTile;
    },
  },
};
