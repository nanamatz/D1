import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const blackletterEngine: JokerDef = {
  id: 'blackletterEngine', gddNumber: 16, nameKo: '블랙레터 엔진', nameEn: 'Blackletter Engine',
  emoji: '⚙️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tilesPlayed: ({ blind, tiles, enhancedTiles }, self) => {
      const current = blind.sequence.at(-1);
      const eligible = blind.sequence.filter((word) => !word.isGibberish && !word.debuffed);
      if (eligible.length !== 1 || eligible[0] !== current) return;
      for (const tile of tiles) {
        if (tile.material === 'stone' || tile.font !== 'medium') continue;
        tile.font = 'black';
        enhancedTiles?.push({
          tile,
          jokerId: self.defId,
          ...(self.instanceId !== undefined ? { jokerInstanceId: self.instanceId } : {}),
        });
      }
    },
  },
};
