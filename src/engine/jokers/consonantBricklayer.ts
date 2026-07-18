/** #2 Consonant Bricklayer (Common, layer 1): +4 Chips per consonant. Fires per-tile
 *  (item 3) so it lands as each consonant tile scores; fires on gibberish too — layer
 *  1 reads letters (GDD §6.4). */
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
    tileScoring: ({ ctx, tile }) => {
      if (isConsonant(tile.letter)) {
        ctx.chips += BALANCE.jokers.consonantBricklayer.chipsPerConsonant;
      }
    },
  },
};
