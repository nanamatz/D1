import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bookworm: JokerDef = {
  id: 'bookworm', gddNumber: 24, nameKo: '책벌레', nameEn: 'Bookworm',
  emoji: '🐛', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx, scoreBeats }) => {
      if (ctx.submission.isGibberish) return;
      const count = blind.sequence.filter((word) => !word.isGibberish && !word.debuffed).length + 1;
      ctx.chips += count * BALANCE.jokers.bookworm.chipsPerWord;
      for (let index = 0; index < count; index += 1) {
        scoreBeats?.push({ chipsDelta: BALANCE.jokers.bookworm.chipsPerWord, multDelta: 0 });
      }
    },
  },
};
