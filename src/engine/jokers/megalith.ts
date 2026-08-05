import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import type { Letter, Tile } from '../types';

const LETTERS = Object.keys(BALANCE.bagComposition) as Letter[];

export const megalith: JokerDef = {
  id: 'megalith',
  gddNumber: 49,
  nameKo: '거석상',
  nameEn: 'Megalith',
  emoji: '🗿',
  rarity: 'common',
  layer: 3,
  price: BALANCE.jokerPrice.common,
  hooks: {
    blindSelected: ({ run, blind, rng, createdTiles, triggers }, self, env) => {
      const made: Tile[] = [];
      for (let index = 0; index < BALANCE.jokers.megalith.stonesPerBlind; index += 1) {
        const hidden = LETTERS[rng.int(LETTERS.length)]!;
        const tile: Tile = {
          id: `mg${rng.int(1_000_000)}-${run.bag.length}-${index}`,
          letter: null,
          letterBeforeStone: hidden,
          material: 'stone',
          font: 'medium',
          edition: 'base',
        };
        run.bag.push(tile);
        blind.bag.push(tile);
        createdTiles.push(tile);
        made.push(tile);
      }
      triggers.push({ joker: self, jokerIndex: env.index, createdTiles: made });
    },
  },
};
