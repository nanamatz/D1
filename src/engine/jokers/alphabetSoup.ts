import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alphabetSoup: JokerDef = {
  id: 'alphabetSoup', gddNumber: 11, nameKo: '알파벳 수프', nameEn: 'Alphabet Soup',
  emoji: '🥫', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.letter !== null &&
          ctx.submission.tiles.find((candidate) => candidate.letter === tile.letter)?.id === tile.id) {
        ctx.chips += BALANCE.jokers.alphabetSoup.chipsPerDistinctLetter;
      }
    },
  },
};
