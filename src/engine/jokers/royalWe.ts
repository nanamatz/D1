import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const royalWe: JokerDef = {
  id: 'royalWe', gddNumber: 38, nameKo: '짐이 곧 우리', nameEn: 'Royal We',
  emoji: '👑', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ ctx }) => {
      if (ctx.unison) ctx.sentenceMult *= BALANCE.jokers.royalWe.factor;
    },
  },
};
