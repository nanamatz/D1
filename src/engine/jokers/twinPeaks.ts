import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const twinPeaks: JokerDef = {
  id: 'twinPeaks', gddNumber: 28, nameKo: '쌍둥이 봉우리', nameEn: 'Twin Peaks',
  emoji: '⛰️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordRules: ({ ctx }) => {
      const tiles = ctx.submission.tiles;
      for (let i = 1; i < tiles.length; i++) {
        if (tiles[i]!.letter !== null && tiles[i]!.letter === tiles[i - 1]!.letter) {
          addTileRetrigger(ctx, tiles[i - 1]!.id, 'twinPeaks');
          addTileRetrigger(ctx, tiles[i]!.id, 'twinPeaks');
          return;
        }
      }
    },
  },
};
