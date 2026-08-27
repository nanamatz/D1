import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const doubleImpression: JokerDef = {
  id: 'doubleImpression', gddNumber: 26, nameKo: '두 번 찍기', nameEn: 'Double Impression',
  emoji: '⏺️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordRules: ({ ctx }, self) => {
      for (const tile of ctx.submission.tiles) {
        if (tile.font === 'black') addTileRetrigger(ctx, tile.id, self.defId, self.instanceId);
      }
    },
  },
};
