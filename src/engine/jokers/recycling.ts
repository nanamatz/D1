import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const LETTERS = Object.keys(BALANCE.letterChips);

export const recycling: JokerDef = {
  id: 'recycling', gddNumber: 52, nameKo: '리사이클링', nameEn: 'Recycling',
  emoji: '♻️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    blindSelected: ({ rng, triggers }, self, env) => {
      self.state.letterCode = LETTERS[rng.int(LETTERS.length)]!.charCodeAt(0);
      triggers.push({ joker: self, jokerIndex: env.index, createdTiles: [] });
    },
    tilesDiscarded: ({ run, tiles }, self) => {
      const matches = tiles.filter(
        (tile) => tile.letter?.charCodeAt(0) === self.state.letterCode,
      ).length;
      run.gold += matches * BALANCE.jokers.recycling.goldPerTile;
    },
  },
};
