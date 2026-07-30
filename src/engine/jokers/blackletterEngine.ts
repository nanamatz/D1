import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const blackletterEngine: JokerDef = {
  id: 'blackletterEngine', gddNumber: 16, nameKo: '블랙레터 엔진', nameEn: 'Blackletter Engine',
  emoji: '⚙️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordRules: ({ ctx }) => {
      for (const tile of ctx.submission.tiles) {
        if (tile.font === 'black') addTileRetrigger(ctx, tile.id, 'blackletterEngine');
      }
    },
  },
};
