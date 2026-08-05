import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const noiseCancellingFactor = (skippedBlinds: number): number =>
  BALANCE.jokers.noiseCancelling.baseFactor
  + skippedBlinds * BALANCE.jokers.noiseCancelling.factorPerSkippedBlind;

export const noiseCancelling: JokerDef = {
  id: 'noiseCancelling', gddNumber: 45, nameKo: '노이즈캔슬링', nameEn: 'Noise Cancelling',
  emoji: '🎧', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: {
    kind: 'mult',
    stateKey: 'factor',
    initial: BALANCE.jokers.noiseCancelling.baseFactor,
  },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const factor = noiseCancellingFactor(run.skippedBlinds);
      self.state.factor = factor;
      ctx.mult *= factor;
    },
  },
};
