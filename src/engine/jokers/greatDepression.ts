import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { pouchDisablesInterest } from '../pouches';
import { recordDisablesInterest } from '../records';

export const greatDepression: JokerDef = {
  id: 'greatDepression', gddNumber: 61, nameKo: '대공황', nameEn: 'Great Depression',
  emoji: '📊', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    interestScoring: (payload) => {
      if (pouchDisablesInterest(payload.run) || recordDisablesInterest(payload.run)) return;
      payload.interest += Math.floor(
        payload.run.gold / BALANCE.jokers.greatDepression.goldPerStepHeld,
      ) * BALANCE.jokers.greatDepression.goldPerStep;
    },
  },
};
