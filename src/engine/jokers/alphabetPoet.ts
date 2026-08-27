import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alphabetPoet: JokerDef = {
  id: 'alphabetPoet', gddNumber: 57, nameKo: '알파벳 시인', nameEn: 'Alphabet Poet',
  emoji: '↗', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordPrepare: ({ spellingTiles }) => {
      for (let index = 0; index < spellingTiles.length; index += 1) {
        const tile = spellingTiles[index]!;
        if (tile.letter === 'Z') spellingTiles[index] = { ...tile, letter: 'A' };
      }
    },
  },
};
