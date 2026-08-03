import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const towerOfBabel: JokerDef = {
  id: 'towerOfBabel',
  gddNumber: 4,
  nameKo: '바벨탑',
  nameEn: 'Tower of Babel',
  emoji: '🗼',
  rarity: 'legendary',
  layer: 2,
  price: BALANCE.jokerPrice.legendary,
  hooks: {
    wordRules: ({ ctx }) => {
      if (ctx.submission.isGibberish) return;
      ctx.scoringSuits ??= new Set();
      for (const suit of ['standard', 'formal', 'slang', 'vulgar'] as const) {
        ctx.scoringSuits.add(suit);
      }
    },
  },
};
