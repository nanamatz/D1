import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alphabetSoup: JokerDef = {
  id: 'alphabetSoup', gddNumber: 11, nameKo: '알파벳 수프', nameEn: 'Alphabet Soup',
  emoji: '🥫', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      ctx.chips += new Set(ctx.submission.tiles.map((tile) => tile.letter).filter(Boolean)).size
        * BALANCE.jokers.alphabetSoup.chipsPerDistinctLetter;
    },
  },
};
