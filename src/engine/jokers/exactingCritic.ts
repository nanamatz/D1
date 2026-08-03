import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const exactingCritic: JokerDef = {
  id: 'exactingCritic', gddNumber: 45, nameKo: '까다로운 평론가', nameEn: 'Exacting Critic',
  emoji: '🧐', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, _self, env) => {
      const uncommons = run.jokers
        .filter((joker) => env.lookup(joker.defId)?.rarity === 'uncommon').length;
      ctx.mult *= BALANCE.jokers.exactingCritic.factorPerUncommon ** uncommons;
    },
  },
};
