import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stoneTongue: JokerDef = {
  id: 'stoneTongue', gddNumber: 18, nameKo: '돌 혀', nameEn: 'Stone Tongue',
  emoji: '🪨', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordPrepare: ({ spellingTiles }) => {
      for (let ignored = 0; ignored < BALANCE.jokers.stoneTongue.ignoredPerWord; ignored += 1) {
        const index = spellingTiles.findIndex((tile) => tile.material === 'stone');
        if (index < 0) break;
        spellingTiles.splice(index, 1);
      }
    },
  },
};
