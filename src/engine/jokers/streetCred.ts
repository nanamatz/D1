import { BALANCE } from '../balance';
import { hasScoringSuit, type JokerDef } from '../events';

/** U7 (GDD §11.3) — ★ every Slang word permanently raises this tile's Chips. */
export const streetCred: JokerDef = {
  scoresGibberish: true,
  id: 'streetCred',
  gddNumber: 7,
  nameKo: '거리의 신용',
  nameEn: 'Street Cred',
  emoji: '🧢',
  rarity: 'uncommon',
  layer: 2,
  price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      ctx.chips += self.state.chips ?? 0;
      if (hasScoringSuit(ctx, 'slang')) {
        self.state.chips = (self.state.chips ?? 0) + BALANCE.jokers.streetCred.chipsPerSlang;
      }
    },
  },
};
