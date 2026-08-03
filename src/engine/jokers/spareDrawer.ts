import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const spareDrawer: JokerDef = {
  id: 'spareDrawer', gddNumber: 32, nameKo: '여분 서랍', nameEn: 'Spare Drawer',
  emoji: '🗄️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    blindStart: ({ blind }) => { blind.handSizeTotal += BALANCE.jokers.spareDrawer.handSize; },
  },
};
