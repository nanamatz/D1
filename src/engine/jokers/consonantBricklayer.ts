/** #2 Consonant Bricklayer (Common, layer 1): +4 Chips per consonant.
 *  Fires on gibberish too — layer 1 reads letters (GDD §6.4). */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { isConsonant } from '../types';

export const consonantBricklayer: JokerDef = {
  id: 'consonantBricklayer',
  gddNumber: 2,
  nameKo: '자음 벽돌공',
  nameEn: 'Consonant Bricklayer',
  emoji: '🧱',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const consonants = ctx.submission.tiles.filter((t) => isConsonant(t.letter)).length;
      ctx.chips += BALANCE.jokers.consonantBricklayer.chipsPerConsonant * consonants;
    },
  },
};
