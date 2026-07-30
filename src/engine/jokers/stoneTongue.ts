import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stoneTongue: JokerDef = {
  id: 'stoneTongue', gddNumber: 18, nameKo: '돌 혀', nameEn: 'Stone Tongue',
  emoji: '🪨', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordPrepare: ({ spellingTiles }) => {
      const index = spellingTiles.findIndex((tile) => tile.material === 'stone');
      if (index >= 0) spellingTiles.splice(index, BALANCE.jokers.stoneTongue.ignoredPerWord);
    },
  },
};
