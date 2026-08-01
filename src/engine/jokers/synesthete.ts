import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const synesthete: JokerDef = {
  id: 'synesthete', gddNumber: 37, nameKo: '공감각자', nameEn: 'Synesthete',
  emoji: '🌈', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const count = new Set(ctx.submission.tiles.map((tile) => `${tile.material}:${tile.font}`)).size;
      ctx.mult *= BALANCE.jokers.synesthete.factorPerCombo ** count;
    },
  },
};
