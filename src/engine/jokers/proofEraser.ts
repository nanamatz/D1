import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const proofEraser: JokerDef = {
  id: 'proofEraser', gddNumber: 31, nameKo: '교정 지우개', nameEn: 'Proof Eraser',
  emoji: '🧽', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    blindStart: ({ blind }) => { blind.discardsLeft += BALANCE.jokers.proofEraser.discards; },
  },
};
