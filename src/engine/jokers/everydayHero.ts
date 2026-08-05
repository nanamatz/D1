import { BALANCE } from '../balance';
import { hasScoringSuit, type JokerDef } from '../events';
import { submissionLength } from '../types';

export const everydayHero: JokerDef = {
  id: 'everydayHero', gddNumber: 10, nameKo: '일상 영웅', nameEn: 'Everyday Hero',
  emoji: '🦸', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      if (
        submissionLength(ctx.submission) >= BALANCE.jokers.everydayHero.minLength &&
        hasScoringSuit(ctx, 'standard')
      ) ctx.mult *= BALANCE.jokers.everydayHero.factor;
    },
  },
};
