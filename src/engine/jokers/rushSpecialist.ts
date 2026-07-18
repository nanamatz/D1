/** #24 Rush Specialist (Rare, layer 2): ×Mult on EACH WORD that scales with how many
 *  phases will remain after it — ×(1 + 0.5 × phasesLeft) (reworked, item 6). It used
 *  to multiply the sentence bonus, which only landed at clear and so just padded an
 *  already-winning score; as a per-word mult it actively drives each word toward the
 *  target, so a fast (early-phase) clear is what pays. A last-phase play pays nothing.
 *  (GDD §11.4, §11.7.) */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const rushSpecialist: JokerDef = {
  id: 'rushSpecialist',
  gddNumber: 24,
  nameKo: '속공 전문가',
  nameEn: 'Rush Specialist',
  emoji: '🏃',
  rarity: 'rare',
  layer: 2,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      // `blind` here is pre-increment, so subtract 1 for the phases that will REMAIN
      // after this word — a last-phase play (0 left) pays nothing.
      const phasesLeft = Math.max(0, blind.phasesTotal - blind.phasesUsed - 1);
      if (phasesLeft > 0) {
        ctx.mult *= 1 + BALANCE.jokers.rushSpecialist.multPerPhase * phasesLeft;
      }
    },
  },
};
