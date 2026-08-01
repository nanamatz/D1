import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alphabetPress: JokerDef = {
  id: 'alphabetPress', gddNumber: 13, nameKo: '알파벳 인쇄기', nameEn: 'Alphabet Press',
  emoji: '🔤', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const letters = ctx.submission.text.toUpperCase();
      let pairs = 0;
      for (let i = 1; i < letters.length; i++) {
        if (letters.charCodeAt(i) === letters.charCodeAt(i - 1) + 1) pairs++;
      }
      ctx.mult *= BALANCE.jokers.alphabetPress.factorPerPair ** pairs;
    },
  },
};
