import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const materialSampler: JokerDef = {
  id: 'materialSampler', gddNumber: 20, nameKo: '재료 수집가', nameEn: 'Material Sampler',
  emoji: '🎨', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (ctx.submission.tiles.find((candidate) => candidate.material === tile.material)?.id === tile.id) {
        ctx.chips += BALANCE.jokers.materialSampler.chipsPerMaterial;
      }
    },
  },
};
