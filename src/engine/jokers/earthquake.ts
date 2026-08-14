import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const earthquake: JokerDef = {
  id: 'earthquake', gddNumber: 58, nameKo: '대지진', nameEn: 'Earthquake',
  emoji: '🌋', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  initialState: () => ({ handsRemaining: BALANCE.jokers.earthquake.hands }),
  hooks: {
    wordRules: ({ ctx }, self) => {
      if ((self.state.handsRemaining ?? BALANCE.jokers.earthquake.hands) <= 0) return;
      for (const tile of ctx.submission.tiles) addTileRetrigger(ctx, tile.id, self.defId);
    },
    wordScored: (_payload, self) => {
      self.state.handsRemaining = Math.max(
        0,
        (self.state.handsRemaining ?? BALANCE.jokers.earthquake.hands) - 1,
      );
    },
  },
};
