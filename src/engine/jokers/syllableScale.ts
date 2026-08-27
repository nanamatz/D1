import { BALANCE } from '../balance';
import { isScoringVowel, scoringLetter, type JokerDef } from '../events';

export const syllableScale: JokerDef = {
  id: 'syllableScale', gddNumber: 17, nameKo: '음절 저울', nameEn: 'Syllable Scale',
  emoji: '⚖️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      const letters = ctx.submission.tiles.map((tile) => scoringLetter(ctx, tile)).filter(Boolean);
      const vowels = letters.filter((letter) => isScoringVowel(ctx, letter)).length;
      if (Math.abs(vowels - (letters.length - vowels)) === BALANCE.jokers.syllableScale.difference) {
        ctx.chips += BALANCE.jokers.syllableScale.chips;
        ctx.mult += BALANCE.jokers.syllableScale.mult;
      }
    },
  },
};
