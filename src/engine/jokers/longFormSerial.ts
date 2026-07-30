import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const longFormSerial: JokerDef = {
  id: 'longFormSerial', gddNumber: 27, nameKo: '장편 연재', nameEn: 'Long-form Serial',
  emoji: '📜', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ ctx }) => {
      const extra = Math.max(0, ctx.submission.tiles.length - BALANCE.jokers.longFormSerial.freeLetters);
      ctx.mult *= BALANCE.jokers.longFormSerial.factorPerLetter ** extra;
    },
  },
};
