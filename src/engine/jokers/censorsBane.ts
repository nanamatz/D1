import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** R8 (GDD §11.4) — ×2.5 Mult during Deadline (boss) blinds. */
export const censorsBane: JokerDef = {
  scoresGibberish: true,
  id: 'censorsBane',
  gddNumber: 8,
  nameKo: '검열관의 적',
  nameEn: "Censor's Bane",
  emoji: '📢',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.kind === 'boss') ctx.mult *= BALANCE.jokers.censorsBane.factor;
    },
  },
};
