/** #24 Rush Specialist (Rare, layer 3): ×Mult that scales with how many phases
 *  are left at clear — ×(1 + 0.5 × phasesLeft) (playtest-04 C-1). Auto-settle
 *  made "cleared with phases left" the default, so a flat conditional bonus was
 *  meaningless; now a 1-phase clear of a 4-phase blind pays big, a last-phase
 *  clear pays nothing. Reads phases left from the blind, so it applies to the
 *  projection preview and the final (GDD §11.4, §11.7). */
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
      if (phasesLeft > 0) {
        ctx.totalMultiplier *= 1 + BALANCE.jokers.rushSpecialist.multPerPhase * phasesLeft;
      }
    },
  },
};
