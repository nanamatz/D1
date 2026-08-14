import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { matchesLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const mirrorImage: JokerDef = {
  id: 'mirrorImage', gddNumber: 63, nameKo: '거울상', nameEn: 'Mirror Image',
  emoji: '🪞', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.mirrorImage.factor,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (matchesLetterHand('palindrome', letterString(ctx.submission.tiles), ctx.submission.isGibberish, ctx.submission.scoringLength)) {
        ctx.mult *= BALANCE.jokers.mirrorImage.factor;
      }
    },
  },
};
