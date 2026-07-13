/** #24 Rush Specialist (Rare, layer 3): ×4 Mult if ending with 2+ phases
 *  remaining — the Rush build's engine (GDD §11.4, §11.7). Reads phases left
 *  from the blind, so it applies to the projection preview and the final. */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const rushSpecialist: JokerDef = {
  id: 'rushSpecialist',
  gddNumber: 24,
  nameKo: '속공 전문가',
  nameEn: 'Rush Specialist',
  emoji: '🏃',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ blind, ctx }) => {
      const phasesLeft = blind.phasesTotal - blind.phasesUsed;
      if (phasesLeft >= BALANCE.jokers.rushSpecialist.minPhasesLeft) {
        ctx.totalMultiplier *= BALANCE.jokers.rushSpecialist.totalMult;
      }
    },
  },
};
