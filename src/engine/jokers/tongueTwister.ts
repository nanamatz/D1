import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const tongueTwister: JokerDef = {
  id: 'tongueTwister', gddNumber: 14, nameKo: '혀 꼬기', nameEn: 'Tongue Twister',
  emoji: '👅', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (ctx.submission.tiles.length >= BALANCE.jokers.tongueTwister.minLength) {
        ctx.mult += BALANCE.jokers.tongueTwister.mult;
      }
    },
  },
};
