import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const hypocrite: JokerDef = {
  id: 'hypocrite',
  gddNumber: 2,
  nameKo: '위선자',
  nameEn: 'Hypocrite',
  emoji: '🎭',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ ctx }) => {
      if (ctx.registerSynergy?.id === 'whiplash') {
        ctx.sentenceMult *= BALANCE.jokers.hypocrite.factor;
      }
    },
  },
};
