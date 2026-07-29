import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/**
 * U4 (GDD §11.3) — +Mult per Glass tile in the played word, and one Glass tile
 * permanently leaves the pouch at each blind end. The removal is deterministic
 * (first Glass in bag order) so no extra RNG draw shifts the seeded stream;
 * `onBlindEnded` re-emits `tilesDestroyed` for the shrink, so Type Foundry (L3)
 * and friends see it like any other permanent destruction.
 */
export const glasswork: JokerDef = {
  id: 'glasswork',
  gddNumber: 4,
  nameKo: '유리 세공',
  nameEn: 'Glasswork',
  emoji: '🪟',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      const glass = ctx.submission.tiles.filter((tile) => tile.material === 'glass').length;
      ctx.mult += glass * BALANCE.jokers.glasswork.multPerGlass;
    },
    blindEnd: ({ run }) => {
      let left = BALANCE.jokers.glasswork.lostPerBlind;
      run.bag = run.bag.filter((tile) => {
        if (left > 0 && tile.material === 'glass') {
          left--;
          return false;
        }
        return true;
      });
    },
  },
};
