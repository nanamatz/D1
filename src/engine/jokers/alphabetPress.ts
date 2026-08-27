import { BALANCE } from '../balance';
import { scoringLetter, type JokerDef } from '../events';

export const alphabetPress: JokerDef = {
  id: 'alphabetPress', gddNumber: 13, nameKo: '알파벳 인쇄기', nameEn: 'Alphabet Press',
  emoji: '🔤', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      const spellingTiles = ctx.spellingTiles ?? ctx.submission.tiles;
      const index = spellingTiles.findIndex((candidate) => candidate.id === tile.id);
      const previous = spellingTiles[index - 1]?.letter;
      const current = scoringLetter(ctx, tile);
      const next = spellingTiles[index + 1]?.letter;
      const followsPrevious = previous != null && current != null &&
        current.charCodeAt(0) === previous.charCodeAt(0) + 1;
      const leadsNext = next != null && current != null &&
        next.charCodeAt(0) === current.charCodeAt(0) + 1;
      if (followsPrevious || leadsNext) {
        ctx.mult *= BALANCE.jokers.alphabetPress.factorPerLetter;
      }
    },
  },
};
