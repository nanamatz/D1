/**
 * Card-pack art mapping. The headless engine stores only a seeded cosmetic
 * artVariant; the UI resolves that index to a pixel-identical runtime PNG.
 */
import type { PackSize, PackType } from '../engine/types';

import tileBasic1 from './assets/packs/T_BasicTilePack1-preview.png';
import tileBasic2 from './assets/packs/T_BasicTilePack2-preview.png';
import tileBasic3 from './assets/packs/T_BasicTilePack3-preview.png';
import tileBasic4 from './assets/packs/T_BasicTilePack4-preview.png';
import tileClassic1 from './assets/packs/T_ClassicTilePack1-preview.png';
import tileClassic2 from './assets/packs/T_ClassicTilePack2-preview.png';
import tilePremium1 from './assets/packs/T_PremiumTilePack1-preview.png';
import tilePremium2 from './assets/packs/T_PremiumTilePack2-preview.png';

import charmBasic1 from './assets/packs/T_BasicCharmPack-preview.png';
import charmBasic2 from './assets/packs/T_BasicCharmPack2-preview.png';
import charmClassic1 from './assets/packs/T_ClassicCharmPack-preview.png';
import charmPremium1 from './assets/packs/T_PremiumCharmPack-preview.png';

import fableBasic1 from './assets/packs/T_BasicFablePack1-preview.png';
import fableBasic2 from './assets/packs/T_BasicFablePack2-preview.png';
import fableBasic3 from './assets/packs/T_BasicFablePack3-preview.png';
import fableBasic4 from './assets/packs/T_BasicFablePack4-preview.png';
import fableClassic1 from './assets/packs/T_ClassicFablePack1-preview.png';
import fableClassic2 from './assets/packs/T_ClassicFablePack2-preview.png';
import fablePremium1 from './assets/packs/T_PremiumFablePack1-preview.png';
import fablePremium2 from './assets/packs/T_PremiumFablePack2-preview.png';

import constellationBasic1 from './assets/packs/T_BasicConstellationPack1-preview.png';
import constellationBasic2 from './assets/packs/T_BasicConstellationPack2-preview.png';
import constellationBasic3 from './assets/packs/T_BasicConstellationPack3-preview.png';
import constellationBasic4 from './assets/packs/T_BasicConstellationPack4-preview.png';
import constellationClassic1 from './assets/packs/T_ClassicConstellationPack1-preview.png';
import constellationClassic2 from './assets/packs/T_ClassicConstellationPack2-preview.png';
import constellationPremium1 from './assets/packs/T_PremiumConstellationPack1-preview.png';
import constellationPremium2 from './assets/packs/T_PremiumConstellationPack2-preview.png';

import inkBasic1 from './assets/packs/T_BasicInkPack1-preview.png';
import inkBasic2 from './assets/packs/T_BasicInkPack2-preview.png';
import inkClassic1 from './assets/packs/T_ClassicInkPack1-preview.png';
import inkPremium1 from './assets/packs/T_PremiumInkPack1-preview.png';

export const PACK_ART: Record<PackType, Record<PackSize, readonly string[]>> = {
  tile: {
    normal: [tileBasic1, tileBasic2, tileBasic3, tileBasic4],
    jumbo: [tileClassic1, tileClassic2],
    mega: [tilePremium1, tilePremium2],
  },
  joker: {
    normal: [charmBasic1, charmBasic2],
    jumbo: [charmClassic1],
    mega: [charmPremium1],
  },
  consumable: {
    normal: [fableBasic1, fableBasic2, fableBasic3, fableBasic4],
    jumbo: [fableClassic1, fableClassic2],
    mega: [fablePremium1, fablePremium2],
  },
  pattern: {
    normal: [
      constellationBasic1,
      constellationBasic2,
      constellationBasic3,
      constellationBasic4,
    ],
    jumbo: [constellationClassic1, constellationClassic2],
    mega: [constellationPremium1, constellationPremium2],
  },
  ink: {
    normal: [inkBasic1, inkBasic2],
    jumbo: [inkClassic1],
    mega: [inkPremium1],
  },
};

export function packArt(type: PackType, size: PackSize, variant: number): string | null {
  const variants = PACK_ART[type][size];
  if (variants.length === 0) return null;
  return variants[((variant % variants.length) + variants.length) % variants.length]!;
}

export type PackGalleryEntry = {
  family: PackType;
  size: PackSize;
  src: string;
};

const SIZE_ORDER: readonly PackSize[] = ['normal', 'jumbo', 'mega'];

/** Image-only Collection pages; the four-card Charm and Ink families share a page. */
export function packGalleryPages(): PackGalleryEntry[][] {
  const entries = (family: PackType) =>
    SIZE_ORDER.flatMap((size) =>
      PACK_ART[family][size].map((src): PackGalleryEntry => ({ family, size, src })),
    );

  return [
    entries('tile'),
    [...entries('joker'), ...entries('ink')],
    entries('consumable'),
    entries('pattern'),
  ];
}
