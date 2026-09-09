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
      const chips = pouchTagChips(blind.bag.length);
      if (chips === 0) return;
      ctx.chips += chips;
      scoreBeats?.push({ chipsDelta: chips, multDelta: 0 });
    },
  },
};
