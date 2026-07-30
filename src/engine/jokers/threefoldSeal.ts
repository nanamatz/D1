import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const threefoldSeal: JokerDef = {
  id: 'threefoldSeal', gddNumber: 29, nameKo: '삼중 인장', nameEn: 'Threefold Seal',
  emoji: '🔱', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordRules: ({ ctx }) => {
      const counts = new Map<string, number>();
      for (const tile of ctx.submission.tiles) {
        if (tile.letter) counts.set(tile.letter, (counts.get(tile.letter) ?? 0) + 1);
      }
      for (const tile of ctx.submission.tiles) {
        if (tile.letter && (counts.get(tile.letter) ?? 0) >= 3) {
          addTileRetrigger(ctx, tile.id, 'threefoldSeal');
        }
      }
    },
  },
};
