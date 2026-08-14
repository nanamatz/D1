import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const zombie: JokerDef = {
  id: 'zombie', gddNumber: 59, nameKo: '좀비', nameEn: 'Zombie',
  emoji: '🧟', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tilesPlayed: ({ blind, tiles }) => {
      const ids = new Set(tiles.map((tile) => tile.id));
      blind.discardedThisBlind = blind.discardedThisBlind.filter((tile) => !ids.has(tile.id));
      blind.bag.push(...tiles);
    },
  },
};
