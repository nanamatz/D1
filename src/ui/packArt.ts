/**
 * Card-pack art (PackSize → pixel-art PNGs). Kept out of the engine — the engine
 * only stores a seeded cosmetic `artVariant` index on each PackSlot; the UI maps
 * (size, variant) → image here. Same headless split as bossArt.ts.
 *
 * The per-size art count MUST match BALANCE.pack.artVariants (the engine picks the
 * variant with rng.int of that count); the modulo guard keeps a stray index safe.
 */
import type { PackSize } from '../engine/types';

import basic1 from './assets/packs/T_BasicPack1.png';
import basic2 from './assets/packs/T_BasicPack2.png';
import basic3 from './assets/packs/T_BasicPack3.png';
import classic1 from './assets/packs/T_ClassicPack1.png';
import classic2 from './assets/packs/T_ClassicPack2.png';
import premium1 from './assets/packs/T_PremiumPack1.png';
import premium2 from './assets/packs/T_PremiumPack2.png';

/** Size → its ordered art variants. normal=Base(3), jumbo=Classic(2), mega=Premium(2). */
export const PACK_ART: Record<PackSize, readonly string[]> = {
  normal: [basic1, basic2, basic3],
  jumbo: [classic1, classic2],
  mega: [premium1, premium2],
};

/** The image for a pack slot; the variant is wrapped so an out-of-range index is safe. */
export function packArt(size: PackSize, variant: number): string {
  const variants = PACK_ART[size];
  return variants[((variant % variants.length) + variants.length) % variants.length]!;
}
