import { BALANCE } from '../balance';
import { addTileRetrigger, type JokerDef } from '../events';

export const loadedLeadDice: JokerDef = {
  id: 'loadedLeadDice', gddNumber: 20, nameKo: '조작된 납 주사위', nameEn: 'Loaded Lead Dice',
  emoji: '🎲', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    materialScored: ({ ctx, tile, triggerIndex, chanceResults = [] }, self) => {
      if (tile.material === 'leadPlate' && triggerIndex === 0 && chanceResults.length === 2 &&
          chanceResults.every((result) => result.outcome === 'failure')) {
        for (let count = 0; count < BALANCE.jokers.loadedLeadDice.retriggers; count += 1) {
          addTileRetrigger(ctx, tile.id, self.defId, self.instanceId);
        }
      }
    },
  },
};
