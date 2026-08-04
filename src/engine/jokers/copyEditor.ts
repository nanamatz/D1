import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const copyEditor: JokerDef = {
  id: 'copyEditor', gddNumber: 41, nameKo: '카피 에디터', nameEn: 'Copy Editor',
  emoji: '👯', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  hooks: {
    selfSold: ({ run, rng }) => {
      if (run.jokers.length === 0) return;
      const target = run.jokers[rng.int(run.jokers.length)]!;
      run.jokers.push({ ...target, state: { ...target.state } });
    },
  },
};
