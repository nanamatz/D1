import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const exactingCritic: JokerDef = {
  scoresGibberish: true,
  id: 'exactingCritic', gddNumber: 45, nameKo: '까다로운 평론가', nameEn: 'Exacting Critic',
  emoji: '🧐', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx, scoreBeats }, _self, env) => {
      const uncommons = run.jokers
        .filter((joker) => env.lookup(joker.defId)?.rarity === 'uncommon').length;
      for (let index = 0; index < uncommons; index += 1) {
        ctx.mult *= BALANCE.jokers.exactingCritic.factorPerUncommon;
        scoreBeats?.push({
          chipsDelta: 0, multDelta: 0,
          multFactor: BALANCE.jokers.exactingCritic.factorPerUncommon,
        });
      }
    },
  },
};
