import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alphabetPress: JokerDef = {
  id: 'alphabetPress', gddNumber: 13, nameKo: '알파벳 인쇄기', nameEn: 'Alphabet Press',
  emoji: '🔤', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      const spellingTiles = ctx.spellingTiles ?? ctx.submission.tiles;
      const index = spellingTiles.findIndex((candidate) => candidate.id === tile.id);
      const previous = spellingTiles[index - 1]?.letter;
      if (index > 0 && previous !== null && previous !== undefined && tile.letter !== null &&
          tile.letter.charCodeAt(0) === previous.charCodeAt(0) + 1) {
        ctx.mult *= BALANCE.jokers.alphabetPress.factorPerPair;
      }
    },
  },
};
