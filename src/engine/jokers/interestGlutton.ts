import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/**
 * R10 (GDD §11.4) — banks the exact final interest line after every modifier,
 * then spends it as additive Mult over the next round.
 */
export const interestGlutton: JokerDef = {
  scoresGibberish: true,
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
    interestResolved: ({ interest }, self, env) => {
      self.state.mult = 0;
      for (let gold = 0; gold < interest; gold += 1) {
        self.state.mult += BALANCE.jokers.interestGlutton.multPerGold;
        env.grow('multAdd', BALANCE.jokers.interestGlutton.multPerGold);
      }
    },
  },
};
