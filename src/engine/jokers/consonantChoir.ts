import { BALANCE } from '../balance';
import { isScoringVowel, type JokerDef } from '../events';

export const consonantChoir: JokerDef = {
  id: 'consonantChoir', gddNumber: 15, nameKo: '자음 합창단', nameEn: 'Consonant Choir',
  emoji: '🎼', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const seen = new Set<string>();
      let duplicates = 0;
      for (const tile of ctx.submission.tiles) {
        if (tile.letter === null || isScoringVowel(ctx, tile.letter)) continue;
        if (seen.has(tile.letter)) duplicates++;
        else seen.add(tile.letter);
      }
      ctx.mult *= BALANCE.jokers.consonantChoir.factorPerDuplicate ** duplicates;
    },
  },
};
