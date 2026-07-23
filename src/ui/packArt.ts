/**
 * Card-pack art ((type, size) → pixel-art PNGs). Kept out of the engine — the engine
 * only stores a seeded cosmetic `artVariant` index on each PackSlot; the UI maps
 * (type, size, variant) → image here. Same headless split as bossArt.ts.
 *
 * The per-(type,size) art count MUST match BALANCE.pack.artVariants (the engine picks
 * the variant with rng.int of that count); the modulo guard keeps a stray index safe.
 * Tile / Charm (joker) / Ink (pattern) have art; Consumable does not yet (→ null).
 */
import type { PackSize, PackType } from '../engine/types';

// Tile pack (활자 → 타일)
import tileBasic1 from './assets/packs/T_BasicPack1.png';
import tileBasic2 from './assets/packs/T_BasicPack2.png';
import tileBasic3 from './assets/packs/T_BasicPack3.png';
import tileClassic1 from './assets/packs/T_ClassicPack1.png';
import tileClassic2 from './assets/packs/T_ClassicPack2.png';
import tilePremium1 from './assets/packs/T_PremiumPack1.png';
import tilePremium2 from './assets/packs/T_PremiumPack2.png';
// Charm pack (부적 = joker)
import charmBasic1 from './assets/packs/T_BasicCharmPack.png';
import charmBasic2 from './assets/packs/T_BasicCharmPack2.png';
import charmClassic1 from './assets/packs/T_ClassicCharmPack.png';
import charmPremium1 from './assets/packs/T_PremiumCharmPack.png';
// Ink pack (잉크 = pattern)
import inkBasic1 from './assets/packs/T_BasicInkPack.png';
import inkBasic2 from './assets/packs/T_BasicInkPack2.png';
import inkBasic3 from './assets/packs/T_BasicInkPack3.png';
import inkBasic4 from './assets/packs/T_BasicInkPack4.png';
import inkClassic1 from './assets/packs/T_ClassicInkPack.png';
import inkClassic2 from './assets/packs/T_ClassicInkPack2.png';
import inkPremium1 from './assets/packs/T_PremiumInkPack.png';
import inkPremium2 from './assets/packs/T_PremiumInkPack2.png';

/**
 * (type → size → ordered art variants). A type absent here (consumable) has no art
 * yet. Variant counts per (type,size) must match BALANCE.pack.artVariants.
 */
export const PACK_ART: Partial<Record<PackType, Record<PackSize, readonly string[]>>> = {
  tile: {
    normal: [tileBasic1, tileBasic2, tileBasic3],
    jumbo: [tileClassic1, tileClassic2],
    mega: [tilePremium1, tilePremium2],
  },
  joker: {
    normal: [charmBasic1, charmBasic2],
    jumbo: [charmClassic1],
    mega: [charmPremium1],
  },
  pattern: {
    normal: [inkBasic1, inkBasic2, inkBasic3, inkBasic4],
    jumbo: [inkClassic1, inkClassic2],
    mega: [inkPremium1, inkPremium2],
  },
};

/** Whether a pack type has art (else it renders as a glyph / "coming soon"). */
export function hasPackArt(type: PackType): boolean {
  return PACK_ART[type] !== undefined;
}

/**
 * The image for a pack slot, or null when the type has no art (consumable). The
 * variant is wrapped so an out-of-range index is safe.
 */
export function packArt(type: PackType, size: PackSize, variant: number): string | null {
  const variants = PACK_ART[type]?.[size];
  if (!variants || variants.length === 0) return null;
  return variants[((variant % variants.length) + variants.length) % variants.length]!;
}

// ---- Collection gallery (Reference.png) ----

/** One card in the 도감 Packs gallery: a real pack art, or a not-yet-arted pack. */
export type PackGalleryEntry =
  | { kind: 'art'; type: PackType; size: PackSize; src: string }
  | { kind: 'comingSoon'; type: PackType };

/** Gallery page order — one page per pack type (matching Reference.png's per-type pages). */
const GALLERY_ORDER: readonly PackType[] = ['tile', 'joker', 'pattern', 'consumable'];
const SIZE_ORDER: readonly PackSize[] = ['normal', 'jumbo', 'mega'];

/**
 * The gallery, one page per pack type (Reference.png): each art-backed type shows all
 * its variants in size order (Basic → Classic → Premium); a type without art yet shows
 * a single "coming soon" card. Pure + deterministic so it can be unit-tested.
 */
export function packGalleryPages(): PackGalleryEntry[][] {
  return GALLERY_ORDER.map((type) => {
    const byType = PACK_ART[type];
    if (!byType) return [{ kind: 'comingSoon', type }];
    return SIZE_ORDER.flatMap((size) =>
      byType[size].map((src): PackGalleryEntry => ({ kind: 'art', type, size, src })),
    );
  });
}
