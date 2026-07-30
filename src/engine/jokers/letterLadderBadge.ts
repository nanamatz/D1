import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const letterLadderBadge: JokerDef = {
  id: 'letterLadderBadge', gddNumber: 29, nameKo: '사다리 배지', nameEn: 'Letter Ladder Badge',
  emoji: '🪜', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (evaluateLetterHand(letterString(ctx.submission.tiles), ctx.submission.isGibberish)?.id === 'straight') {
        ctx.chips += BALANCE.jokers.letterLadderBadge.chips;
      }
    },
  },
};
