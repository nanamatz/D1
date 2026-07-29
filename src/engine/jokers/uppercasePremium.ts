import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C4 (GDD §11.2) — flat Chips per uppercase tile, layer 1 (fires on gibberish too). */
export const uppercasePremium: JokerDef = {
  id: 'uppercasePremium',
  gddNumber: 4,
  nameKo: '대문자 프리미엄',
  nameEn: 'Uppercase Premium',
  emoji: '🔠',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.case === 'upper') ctx.chips += BALANCE.jokers.uppercasePremium.chips;
    },
  },
};
