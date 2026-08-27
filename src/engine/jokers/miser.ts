import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C10 (GDD §11.2) — +Mult scaled by gold currently held, layer 1. */
export const miser: JokerDef = {
  scoresGibberish: true,
  id: 'miser',
  gddNumber: 10,
  nameKo: '구두쇠',
  nameEn: 'Miser',
  emoji: '🪙',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ run, ctx, scoreBeats }) => {
      const { goldPer, mult } = BALANCE.jokers.miser;
      const groups = Math.floor(Math.max(0, run.gold) / goldPer);
      for (let index = 0; index < groups; index += 1) {
        ctx.mult += mult;
        scoreBeats?.push({ chipsDelta: 0, multDelta: mult });
      }
    },
  },
};
