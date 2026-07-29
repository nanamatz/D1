import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const RARE = new Set<string>(BALANCE.rareLetters);

/** U3 (GDD §11.3) — ×3 Chips on Q·Z·X·J. Applied as the extra (factor−1)× of that
 *  tile's own letter chips so it interleaves as a per-tile beat instead of
 *  multiplying the whole running Chips total. */
export const rareEarth: JokerDef = {
  id: 'rareEarth',
  gddNumber: 3,
  nameKo: '희토류',
  nameEn: 'Rare Earth',
  emoji: '💎',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.letter === null || !RARE.has(tile.letter)) return;
      const chips = BALANCE.letterChips[tile.letter] ?? 0;
      ctx.chips += chips * (BALANCE.jokers.rareEarth.factor - 1);
    },
  },
};
