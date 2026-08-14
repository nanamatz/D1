import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const leak: JokerDef = {
  id: 'leak', gddNumber: 62, nameKo: '누수', nameEn: 'Leak',
  emoji: '💧', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ run, ctx }) => {
      const missing = Math.max(0, BALANCE.jokers.leak.baselineTiles - run.bag.length);
      ctx.mult += missing * BALANCE.jokers.leak.multPerMissingTile;
    },
  },
};
