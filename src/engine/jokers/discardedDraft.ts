import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const discardedDraft: JokerDef = {
  id: 'discardedDraft', gddNumber: 28, nameKo: '버린 초고', nameEn: 'Discarded Draft',
  emoji: '🗞️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      ctx.chips += blind.discardedThisBlind.length * BALANCE.jokers.discardedDraft.chipsPerTile;
    },
  },
};
