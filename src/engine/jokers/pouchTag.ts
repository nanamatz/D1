import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const pouchTagChips = (remainingTiles: number): number =>
  Math.floor(remainingTiles / BALANCE.jokers.pouchTag.tilesPerStep)
  * BALANCE.jokers.pouchTag.chipsPerStep;

export const pouchTag: JokerDef = {
  scoresGibberish: true,
  id: 'pouchTag', gddNumber: 23, nameKo: '자루 꼬리표', nameEn: 'Pouch Tag',
  emoji: '🏷️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx, scoreBeats }) => {
      const steps = Math.floor(blind.bag.length / BALANCE.jokers.pouchTag.tilesPerStep);
      for (let index = 0; index < steps; index += 1) {
        ctx.chips += BALANCE.jokers.pouchTag.chipsPerStep;
        scoreBeats?.push({ chipsDelta: BALANCE.jokers.pouchTag.chipsPerStep, multDelta: 0 });
      }
    },
  },
};
