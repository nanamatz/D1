import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alliterationSticker: JokerDef = {
  id: 'alliterationSticker', gddNumber: 25, nameKo: '두운 스티커', nameEn: 'Alliteration Sticker',
  emoji: '✨', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence.at(-1);
      if (
        !ctx.submission.isGibberish &&
        previous && !previous.isGibberish && !previous.debuffed &&
        previous.text[0] === ctx.submission.text[0]
      ) ctx.mult += BALANCE.jokers.alliterationSticker.mult;
    },
  },
};
