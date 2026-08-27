import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { matchesLetterHand } from '../letterHands';
import { submissionLetterString } from '../scoring';

export const gathering: JokerDef = {
  id: 'gathering', gddNumber: 64, nameKo: '모임', nameEn: 'Gathering',
  emoji: '◯', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.gathering.factor,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (matchesLetterHand('vowelFlush', submissionLetterString(ctx.submission), ctx.submission.isGibberish, ctx.submission.scoringLength)) {
        ctx.mult *= BALANCE.jokers.gathering.factor;
      }
    },
  },
};
