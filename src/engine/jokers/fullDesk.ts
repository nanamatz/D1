import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const fullDesk: JokerDef = {
  id: 'fullDesk', gddNumber: 31, nameKo: '가득 찬 책상', nameEn: 'Full Desk',
  emoji: '🗄️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    heldTileScoring: ({ ctx }) => {
      ctx.chips += BALANCE.jokers.fullDesk.chipsPerHeldTile;
    },
  },
};
