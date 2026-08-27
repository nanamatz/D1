import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { pouchDisablesInterest } from '../pouches';
import { recordDisablesInterest } from '../records';

export const greatDepression: JokerDef = {
  id: 'greatDepression', gddNumber: 61, nameKo: '대공황', nameEn: 'Great Depression',
  emoji: '📊', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    interestScoring: (payload, _self, env) => {
      if (pouchDisablesInterest(payload.run) || recordDisablesInterest(payload.run)) return;
      const steps = Math.floor(
        payload.run.gold / BALANCE.jokers.greatDepression.goldPerStepHeld,
      );
      for (let step = 0; step < steps; step += 1) {
        payload.interest += BALANCE.jokers.greatDepression.goldPerStep;
        env.grow('gold', BALANCE.jokers.greatDepression.goldPerStep);
      }
    },
  },
};
