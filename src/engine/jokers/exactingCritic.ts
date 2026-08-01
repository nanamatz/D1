import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const exactingCritic: JokerDef = {
  id: 'exactingCritic', gddNumber: 45, nameKo: '까다로운 평론가', nameEn: 'Exacting Critic',
  emoji: '🧐', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self, env) => {
      const index = run.jokers.indexOf(self);
      const rareLeft = run.jokers.slice(0, Math.max(0, index))
        .filter((joker) => env.lookup(joker.defId)?.rarity === 'rare').length;
      ctx.mult *= BALANCE.jokers.exactingCritic.factorPerRareLeft ** rareLeft;
    },
  },
};
