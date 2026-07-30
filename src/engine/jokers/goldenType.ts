import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const goldenType: JokerDef = {
  id: 'goldenType', gddNumber: 42, nameKo: '금빛 활자', nameEn: 'Golden Type',
  emoji: '🪙', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tileGold: ({ ctx }) => { ctx.chips += BALANCE.jokers.goldenType.chips; },
  },
};
