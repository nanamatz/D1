import { BALANCE } from '../balance';
import { isScoringVowel, scoringLetter, type JokerDef } from '../events';

export const assonance: JokerDef = {
  id: 'assonance', gddNumber: 26, nameKo: '모음 운율', nameEn: 'Assonance',
  emoji: '🎵', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const counts = new Map<string, number>();
      for (const tile of ctx.submission.tiles) {
        const letter = scoringLetter(ctx, tile);
        if (isScoringVowel(ctx, letter)) {
          counts.set(letter!, (counts.get(letter!) ?? 0) + 1);
        }
      }
      if ([...counts.values()].some((count) => count >= BALANCE.jokers.assonance.repeatedVowels)) {
        ctx.mult += BALANCE.jokers.assonance.mult;
      }
    },
  },
};
