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
    wordScoring: ({ blind, ctx, scoreBeats }) => {
      if (blind.phasesUsed !== blind.phasesTotal - 1) return;
      for (const word of blind.sequence) {
        if (word.isGibberish || word.debuffed) continue;
        ctx.scoreBonus = (ctx.scoreBonus ?? 0) + word.settledScore;
        scoreBeats?.push({ chipsDelta: 0, multDelta: 0, scoreDelta: word.settledScore });
      }
    },
  },
};
