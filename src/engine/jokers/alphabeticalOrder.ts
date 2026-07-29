import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C9 (GDD §11.2) — +Chips when two adjacent played tiles are consecutive letters
 *  (AB, CD…). A letterless Stone tile (letter null) never forms a pair (§2.2). */
export const alphabeticalOrder: JokerDef = {
  id: 'alphabeticalOrder',
  gddNumber: 9,
  nameKo: '알파벳 순서',
  nameEn: 'Alphabetical Order',
  emoji: '🔤',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const tiles = ctx.submission.tiles;
      for (let i = 1; i < tiles.length; i++) {
        const a = tiles[i - 1]!.letter;
        const b = tiles[i]!.letter;
        if (a === null || b === null) continue;
        if (b.charCodeAt(0) - a.charCodeAt(0) === 1) {
          ctx.chips += BALANCE.jokers.alphabeticalOrder.chips;
          return;
        }
      }
    },
  },
};
