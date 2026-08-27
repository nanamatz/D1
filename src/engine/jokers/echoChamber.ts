import type { JokerDef } from '../events';
import { BALANCE } from '../balance';

export const echoChamber: JokerDef = {
  id: 'echoChamber', gddNumber: 17, nameKo: '메아리 방', nameEn: 'Echo Chamber',
  emoji: '📢', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  copiesRight: true,
  scoresGibberish: true,
  hooks: {},
};
