import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionSuits } from '../types';

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
      const suits = new Set(ctx.sequence.flatMap((word) => submissionSuits(word)));
      if (suits.has('formal') && suits.has('vulgar')) {
        ctx.sentenceMult *= BALANCE.jokers.hypocrite.factor;
      }
    },
  },
};
