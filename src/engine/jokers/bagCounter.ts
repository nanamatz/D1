import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bagCounter: JokerDef = {
  scoresGibberish: true,
  id: 'bagCounter', gddNumber: 34, nameKo: '자루 계수기', nameEn: 'Bag Counter',
  emoji: '🧮', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx, scoreBeats }) => {
      const steps = Math.floor(blind.bag.length / BALANCE.jokers.bagCounter.tilesPerStep);
      for (let index = 0; index < steps; index += 1) {
        ctx.mult += BALANCE.jokers.bagCounter.multPerStep;
        scoreBeats?.push({ chipsDelta: 0, multDelta: BALANCE.jokers.bagCounter.multPerStep });
      }
    },
  },
};
