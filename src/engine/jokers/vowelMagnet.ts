import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { isConsonant, isVowel } from '../types';

/** U9 (GDD §11.3) — ×Mult when the word holds more vowels than consonants.
 *  A letterless Stone tile is neither (§2.1), so it counts on neither side. */
export const vowelMagnet: JokerDef = {
  id: 'vowelMagnet',
  gddNumber: 9,
  nameKo: '모음 자석',
  nameEn: 'Vowel Magnet',
  emoji: '🧲',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const tiles = ctx.submission.tiles;
      const vowels = tiles.filter((tile) => isVowel(tile.letter)).length;
      const consonants = tiles.filter((tile) => isConsonant(tile.letter)).length;
      if (vowels > consonants) ctx.mult *= BALANCE.jokers.vowelMagnet.factor;
    },
  },
};
