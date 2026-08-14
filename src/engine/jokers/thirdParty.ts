import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { matchesLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const thirdParty: JokerDef = {
  id: 'thirdParty', gddNumber: 62, nameKo: '제3자', nameEn: 'Third Party',
  emoji: '3', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.thirdParty.factor,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (matchesLetterHand('triplet', letterString(ctx.submission.tiles), ctx.submission.isGibberish, ctx.submission.scoringLength)) {
        ctx.mult *= BALANCE.jokers.thirdParty.factor;
      }
    },
  },
};
