import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const rotaryPress: JokerDef = {
  id: 'rotaryPress',
  gddNumber: 11,
  nameKo: '윤전기',
  nameEn: 'Rotary Press',
  emoji: '🌪️',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.phasesUsed !== blind.phasesTotal - 1) return;
      ctx.scoreBonus =
        (ctx.scoreBonus ?? 0) +
        blind.sequence.reduce((sum, word) => sum + word.settledScore, 0);
    },
  },
};
