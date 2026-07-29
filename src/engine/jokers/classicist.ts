import { BALANCE } from '../balance';
import { hasScoringSuit, type JokerDef } from '../events';

/** U6 (GDD §11.3) — ★ every Formal word permanently raises this tile's Mult. */
export const classicist: JokerDef = {
  id: 'classicist',
  gddNumber: 6,
  nameKo: '고전주의자',
  nameEn: 'Classicist',
  emoji: '🏛️',
  rarity: 'uncommon',
  layer: 2,
  price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      ctx.mult += self.state.mult ?? 0;
      if (hasScoringSuit(ctx, 'formal')) {
        self.state.mult = (self.state.mult ?? 0) + BALANCE.jokers.classicist.multPerFormal;
      }
    },
  },
};
