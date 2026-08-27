import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const sentenceOpener: JokerDef = {
  id: 'sentenceOpener', gddNumber: 38, nameKo: '문장 첫머리', nameEn: 'Sentence Opener',
  emoji: '🔠', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (
        !ctx.submission.isGibberish &&
        !blind.sequence.some((word) => !word.isGibberish && !word.debuffed) &&
        ctx.posTags?.includes('noun')
      ) ctx.mult *= BALANCE.jokers.sentenceOpener.factor;
    },
  },
};
