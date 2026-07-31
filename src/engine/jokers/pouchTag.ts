import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const pouchTagChips = (remainingTiles: number): number =>
  Math.floor(remainingTiles / BALANCE.jokers.pouchTag.tilesPerStep)
  * BALANCE.jokers.pouchTag.chipsPerStep;

export const pouchTag: JokerDef = {
  id: 'pouchTag', gddNumber: 23, nameKo: '자루 꼬리표', nameEn: 'Pouch Tag',
  emoji: '🏷️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      ctx.chips += pouchTagChips(blind.bag.length);
    },
  },
};
