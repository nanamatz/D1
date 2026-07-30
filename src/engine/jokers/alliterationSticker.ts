import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alliterationSticker: JokerDef = {
  id: 'alliterationSticker', gddNumber: 25, nameKo: '두운 스티커', nameEn: 'Alliteration Sticker',
  emoji: '✨', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = [...blind.sequence].reverse().find((word) => !word.isGibberish);
      if (
        !ctx.submission.isGibberish &&
        previous?.tiles[0]?.letter === ctx.submission.tiles[0]?.letter
      ) ctx.mult += BALANCE.jokers.alliterationSticker.mult;
    },
  },
};
