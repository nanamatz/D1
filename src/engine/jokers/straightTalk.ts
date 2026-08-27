import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { matchesLetterHand } from '../letterHands';
import { submissionLetterString } from '../scoring';

export const straightTalk: JokerDef = {
  id: 'straightTalk', gddNumber: 65, nameKo: '직설', nameEn: 'Straight Talk',
  emoji: '→', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.straightTalk.factor,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (matchesLetterHand('straight', submissionLetterString(ctx.submission), ctx.submission.isGibberish, ctx.submission.scoringLength)) {
        ctx.mult *= BALANCE.jokers.straightTalk.factor;
      }
    },
  },
};
