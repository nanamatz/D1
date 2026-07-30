import { BALANCE } from '../balance';
import { addTileRetrigger, hasScoringSuit, type JokerDef } from '../events';

export const slangDictionary: JokerDef = {
  id: 'slangDictionary', gddNumber: 12, nameKo: '속어 사전', nameEn: 'Slang Dictionary',
  emoji: '📖', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordRules: ({ ctx }, self) => {
      const tile = ctx.submission.tiles[0];
      if (tile && hasScoringSuit(ctx, 'slang')) addTileRetrigger(ctx, tile.id, self.defId);
    },
  },
};
