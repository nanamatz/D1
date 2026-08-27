import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const hollowPromise: JokerDef = {
  id: 'hollowPromise', gddNumber: 25, nameKo: '속 빈 약속', nameEn: 'Hollow Promise',
  emoji: '⭕', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tilesDiscarded: ({ run, tiles }, _self, env) => {
      const matches = tiles.filter((tile) => tile.font === 'inline').length;
      for (let index = 0; index < matches; index += 1) {
        run.gold += BALANCE.jokers.hollowPromise.goldPerTile;
        env.grow('gold', BALANCE.jokers.hollowPromise.goldPerTile);
      }
    },
  },
};
