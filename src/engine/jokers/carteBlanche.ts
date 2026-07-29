import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const carteBlanche: JokerDef = {
  id: 'carteBlanche',
  gddNumber: 1,
  nameKo: '백지 위임',
  nameEn: 'Carte Blanche',
  emoji: '📃',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  hooks: {},
};
