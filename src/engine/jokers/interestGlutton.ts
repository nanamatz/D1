import { BALANCE } from '../balance';
import { effectiveInterest } from '../economy';
import type { JokerDef } from '../events';

/**
 * R10 (GDD §11.4) — ★ +2 Mult per $1 of interest received at round end, spent
 * over the NEXT round. `blindEnd` fires before the payout, but gold is unchanged
 * between the two, so this reads exactly the interest `resolveBlind` will pay.
 * The value is overwritten (not accumulated) each blind end, as specified.
 */
export const interestGlutton: JokerDef = {
  id: 'interestGlutton',
  gddNumber: 10,
  nameKo: '이자 탐식가',
  nameEn: 'Interest Glutton',
  emoji: '🏦',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      ctx.mult += self.state.mult ?? 0;
    },
    blindEnd: ({ run }, self) => {
      self.state.mult = effectiveInterest(run) * BALANCE.jokers.interestGlutton.multPerGold;
    },
  },
};
