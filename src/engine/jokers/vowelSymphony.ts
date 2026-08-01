import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const vowelSymphony: JokerDef = {
  id: 'vowelSymphony', gddNumber: 26, nameKo: '모음 교향곡', nameEn: 'Vowel Symphony',
  emoji: '🎹', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      if (evaluateLetterHand(letterString(ctx.submission.tiles), ctx.submission.isGibberish)?.id === 'vowelFlush') {
        ctx.mult *= BALANCE.jokers.vowelSymphony.factor;
      }
    },
  },
};
