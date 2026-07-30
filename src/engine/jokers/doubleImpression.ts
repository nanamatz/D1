import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const doubleImpression: JokerDef = {
  id: 'doubleImpression', gddNumber: 26, nameKo: '두 번 찍기', nameEn: 'Double Impression',
  emoji: '⏺️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordRules: ({ ctx }, self) => {
      const tile = ctx.submission.tiles.find((candidate) => candidate.font === 'black');
      if (tile) addTileRetrigger(ctx, tile.id, self.defId);
    },
  },
};
