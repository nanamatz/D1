import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const acrosticPoet: JokerDef = {
  id: 'acrosticPoet', gddNumber: 12, nameKo: '두문자 시인', nameEn: 'Acrostic Poet',
  emoji: '📝', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ ctx, lookup }) => {
      if (ctx.sequence.length > 0 && ctx.sequence.every((word) => !word.isGibberish)) {
        const acrostic = ctx.sequence.map((word) => word.text[0]).join('');
        if (lookup?.(acrostic)) ctx.sentenceMult *= BALANCE.jokers.acrosticPoet.factor;
      }
    },
  },
};
