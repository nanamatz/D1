import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const loadedLeadDice: JokerDef = {
  id: 'loadedLeadDice', gddNumber: 20, nameKo: '조작된 납 주사위', nameEn: 'Loaded Lead Dice',
  emoji: '🎲', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    materialScored: ({ ctx, tile, triggerIndex, chipsDelta, multDelta, goldDelta }) => {
      if (tile.material === 'leadPlate' && triggerIndex === 0 &&
          (chipsDelta !== 0 || multDelta !== 0 || goldDelta !== 0)) {
        addTileRetrigger(ctx, tile.id, 'loadedLeadDice');
      }
    },
  },
};
