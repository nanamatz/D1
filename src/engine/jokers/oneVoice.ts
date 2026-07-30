import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const oneVoice: JokerDef = {
  id: 'oneVoice', gddNumber: 13, nameKo: '한목소리', nameEn: 'One Voice',
  emoji: '🗣️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const suits = [
        ...blind.sequence.filter((word) => !word.isGibberish).map((word) => word.suit),
        ...(ctx.submission.isGibberish ? [] : [ctx.submission.suit]),
      ];
      if (suits.length > 0 && suits.every((suit) => suit === suits[0])) {
        ctx.chips += BALANCE.jokers.oneVoice.chips;
      }
    },
  },
};
