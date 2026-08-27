import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stoneTongue: JokerDef = {
  id: 'stoneTongue', gddNumber: 18, nameKo: '돌 혀', nameEn: 'Stone Tongue',
  emoji: '🪨', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordPrepare: ({ spellingTiles }) => {
      for (let index = spellingTiles.length - 1; index >= 0; index -= 1) {
        if (spellingTiles[index]!.material === 'stone') spellingTiles.splice(index, 1);
      }
    },
  },
};
