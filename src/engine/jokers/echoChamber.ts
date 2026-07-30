import { addTileRetrigger, type JokerDef } from '../events';
import { BALANCE } from '../balance';

export const echoChamber: JokerDef = {
  id: 'echoChamber', gddNumber: 17, nameKo: '메아리 방', nameEn: 'Echo Chamber',
  emoji: '📢', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordRules: ({ ctx }) => {
      const first = new Map<string, string>();
      const repeated = new Set<string>();
      for (const tile of ctx.submission.tiles) {
        if (tile.letter === null) continue;
        if (first.has(tile.letter)) repeated.add(tile.letter);
        else first.set(tile.letter, tile.id);
      }
      for (const letter of repeated) addTileRetrigger(ctx, first.get(letter)!, 'echoChamber');
    },
  },
};
