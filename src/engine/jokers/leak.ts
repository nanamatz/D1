import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const leak: JokerDef = {
  scoresGibberish: true,
  id: 'leak', gddNumber: 62, nameKo: '누수', nameEn: 'Leak',
  emoji: '💧', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  initialState: (run) => ({
    minSize: run.bag.length,
    stacks: Math.max(0, BALANCE.jokers.leak.baselineTiles - run.bag.length),
    mult: Math.max(0, BALANCE.jokers.leak.baselineTiles - run.bag.length) *
      BALANCE.jokers.leak.multPerMissingTile,
  }),
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    tilesDestroyed: ({ run }, self, env) => {
      const previousMin = self.state.minSize ?? run.bag.length;
      if (run.bag.length >= previousMin) return;
      self.state.minSize = run.bag.length;
      const targetStacks = Math.max(
        self.state.stacks ?? 0,
        BALANCE.jokers.leak.baselineTiles - run.bag.length,
      );
      while ((self.state.stacks ?? 0) < targetStacks) {
        self.state.stacks = (self.state.stacks ?? 0) + 1;
        self.state.mult = (self.state.stacks ?? 0) * BALANCE.jokers.leak.multPerMissingTile;
        env.grow('multAdd', BALANCE.jokers.leak.multPerMissingTile);
      }
      self.state.mult = (self.state.stacks ?? 0) * BALANCE.jokers.leak.multPerMissingTile;
    },
    wordScoring: ({ run, ctx }, self) => {
      if (self.state.minSize === undefined) {
        self.state.minSize = run.bag.length;
        self.state.stacks = Math.max(0, BALANCE.jokers.leak.baselineTiles - run.bag.length);
      }
      self.state.mult = (self.state.stacks ?? 0) * BALANCE.jokers.leak.multPerMissingTile;
      ctx.mult += self.state.mult;
    },
  },
};
