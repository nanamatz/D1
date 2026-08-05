import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bloodTypeA: JokerDef = {
  id: 'bloodTypeA', gddNumber: 48, nameKo: '혈액형 A', nameEn: 'Blood Type A',
  emoji: '🩸', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.letter === 'A' || tile.letter === 'O') {
        ctx.chips += BALANCE.jokers.bloodTypeA.chipsPerLetter;
      }
    },
  },
};
