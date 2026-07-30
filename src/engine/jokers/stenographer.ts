import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stenographer: JokerDef = {
  id: 'stenographer', gddNumber: 15, nameKo: '속기 기사', nameEn: 'Stenographer',
  emoji: '⌨️', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const letters = ctx.submission.tiles.map((tile) => tile.letter).filter(Boolean);
      ctx.mult += (letters.length - new Set(letters).size)
        * BALANCE.jokers.stenographer.multPerRepeatedLetter;
    },
  },
};
