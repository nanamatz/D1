import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionSuits } from '../types';

export const oneVoice: JokerDef = {
  id: 'oneVoice', gddNumber: 13, nameKo: '한목소리', nameEn: 'One Voice',
  emoji: '🗣️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const words = [
        ...blind.sequence.filter((word) => !word.isGibberish),
        ...(ctx.submission.isGibberish ? [] : [ctx.submission]),
      ];
      const common = new Set(words[0] ? submissionSuits(words[0]) : []);
      for (const word of words.slice(1)) {
        const suits = submissionSuits(word);
        for (const suit of common) if (!suits.includes(suit)) common.delete(suit);
      }
      if (words.length > 0 && common.size > 0) {
        ctx.chips += BALANCE.jokers.oneVoice.chips;
      }
    },
  },
};
