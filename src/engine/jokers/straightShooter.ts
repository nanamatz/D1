import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const straightShooter: JokerDef = {
  id: 'straightShooter', gddNumber: 25, nameKo: '직선 사수', nameEn: 'Straight Shooter',
  emoji: '🎯', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (evaluateLetterHand(letterString(ctx.submission.tiles), ctx.submission.isGibberish)?.id === 'straight') {
        ctx.mult *= BALANCE.jokers.straightShooter.factor;
      }
    },
  },
};
