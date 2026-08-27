import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const goldenType: JokerDef = {
  id: 'goldenType', gddNumber: 42, nameKo: '금빛 활자', nameEn: 'Golden Type',
  emoji: '🪙', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tileGold: ({ tile }) => {
      tile.bonusChips = (tile.bonusChips ?? 0) + BALANCE.jokers.goldenType.chips;
    },
  },
};
