import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import type { Tile } from '../types';

export const counterfeit: JokerDef = {
  id: 'counterfeit', gddNumber: 46, nameKo: '모조품', nameEn: 'Counterfeit',
  emoji: '🖨️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ blind, ctx, rng, createdTiles, scoreBeats }) => {
      if (
        blind.sequence.length !== 0
        || ctx.submission.tiles.length !== 1
        || !rng
        || !createdTiles
      ) return;
      const source = ctx.submission.tiles[0]!;
      const copies = Array.from(
        { length: BALANCE.jokers.counterfeit.copies },
        (_, index): Tile => ({ ...source, id: `cf${rng.int(1_000_000)}-${index}` }),
      );
      createdTiles.push(...copies);
      scoreBeats?.push({
        chipsDelta: 0,
        multDelta: 0,
        createdTileIds: copies.map((tile) => tile.id),
        sourceTileId: source.id,
      });
    },
  },
};
