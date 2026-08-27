import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const signature = (word: string): string => [...word.toUpperCase()].sort().join('');

export const temurah: JokerDef = {
  id: 'temurah', gddNumber: 56, nameKo: '테무라', nameEn: 'Temurah',
  emoji: '↻', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.temurah.factor,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence[blind.sequence.length - 1];
      if (ctx.submission.isGibberish || !previous || previous.isGibberish || previous.debuffed) return;
      const currentText = ctx.submission.text.toUpperCase();
      const priorText = previous.text.toUpperCase();
      if (currentText !== priorText && signature(currentText) === signature(priorText)) {
        ctx.mult *= BALANCE.jokers.temurah.factor;
      }
    },
  },
};
