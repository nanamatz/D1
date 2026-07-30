import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const materialSampler: JokerDef = {
  id: 'materialSampler', gddNumber: 20, nameKo: '재료 수집가', nameEn: 'Material Sampler',
  emoji: '🎨', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      ctx.chips += new Set(ctx.submission.tiles.map((tile) => tile.material)).size
        * BALANCE.jokers.materialSampler.chipsPerMaterial;
    },
  },
};
