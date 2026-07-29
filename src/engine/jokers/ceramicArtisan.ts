import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/**
 * C6 (GDD §11.2) — flat Chips per UNENHANCED tile, i.e. `material: 'ceramic'`,
 * the base every letter tile starts on. Display names follow the engine ids
 * (changed 2026-07-30), so the card, the material, and the id all read "Ceramic".
 */
export const ceramicArtisan: JokerDef = {
  id: 'ceramicArtisan',
  gddNumber: 6,
  nameKo: '도자기 장인',
  nameEn: 'Ceramic Artisan',
  emoji: '🏺',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.material === 'ceramic') ctx.chips += BALANCE.jokers.ceramicArtisan.chips;
    },
  },
};
