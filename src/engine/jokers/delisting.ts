import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const delisting: JokerDef = {
  id: 'delisting', gddNumber: 60, nameKo: '상장폐지', nameEn: 'Delisting',
  emoji: '📉', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  initialState: () => ({ checked: 0 }),
  hooks: {
    discardUsed: ({ run, blind, tiles, destroyedTiles }, self) => {
      if (self.state.checked === 1) return;
      self.state.checked = 1;
      if (tiles.length !== 1) return;
      const tile = tiles[0]!;
      run.bag = run.bag.filter((candidate) => candidate.id !== tile.id);
      blind.discardedThisBlind = blind.discardedThisBlind.filter(
        (candidate) => candidate.id !== tile.id,
      );
      destroyedTiles.push(tile);
      run.gold += BALANCE.jokers.delisting.gold;
    },
    blindEnd: (_payload, self) => { self.state.checked = 0; },
  },
};
