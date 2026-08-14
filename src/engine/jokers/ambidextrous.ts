import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { matchesLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const ambidextrous: JokerDef = {
  id: 'ambidextrous', gddNumber: 61, nameKo: '양손잡이', nameEn: 'Ambidextrous',
  emoji: '🙌', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.ambidextrous.factor,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (matchesLetterHand('twin', letterString(ctx.submission.tiles), ctx.submission.isGibberish, ctx.submission.scoringLength)) {
        ctx.mult *= BALANCE.jokers.ambidextrous.factor;
      }
    },
  },
};
