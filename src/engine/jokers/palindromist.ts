import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const palindromist: JokerDef = {
  id: 'palindromist', gddNumber: 24, nameKo: '회문 작가', nameEn: 'Palindromist',
  emoji: '🪞', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const hand = evaluateLetterHand(letterString(ctx.submission.tiles), ctx.submission.isGibberish)?.id;
      if (hand === 'palindrome' || hand === 'grandPalindrome') {
        ctx.mult *= BALANCE.jokers.palindromist.factor;
      }
    },
  },
};
