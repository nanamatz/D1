import { BALANCE } from '../balance';
import { addTileRetrigger, hasScoringSuit, type JokerDef } from '../events';

export const slangDictionary: JokerDef = {
  id: 'slangDictionary', gddNumber: 12, nameKo: '속어 사전', nameEn: 'Slang Dictionary',
  emoji: '📖', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordRules: ({ ctx }, self) => {
      if (!hasScoringSuit(ctx, 'slang')) return;
      for (const tile of ctx.submission.tiles) {
        addTileRetrigger(ctx, tile.id, self.defId, self.instanceId);
      }
    },
  },
};
