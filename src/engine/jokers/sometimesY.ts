import type { JokerDef } from '../events';
import { BALANCE } from '../balance';

export const sometimesY: JokerDef = {
  id: 'sometimesY', gddNumber: 16, nameKo: '반모음 Y', nameEn: 'Sometimes Y',
  emoji: '🇾', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordRules: ({ ctx }) => { ctx.scoringVowels?.add('Y'); },
  },
};
