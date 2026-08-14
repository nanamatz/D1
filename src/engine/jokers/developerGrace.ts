import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const DEVELOPER_GRACE_ID = 'developerGrace';

export const developerGrace: JokerDef = {
  id: DEVELOPER_GRACE_ID, gddNumber: 1, nameKo: '개발자의 은총', nameEn: "Developer's Grace",
  emoji: '✦', rarity: 'primordial', layer: 3, price: BALANCE.jokerPrice.primordial,
  hooks: {
    blindStart: ({ blind }) => { blind.target = 1; },
  },
};
