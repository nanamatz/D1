/**
 * Card-pack art mapping. The headless engine stores only a seeded cosmetic
 * artVariant; the UI resolves that index to a normalized path-only SVG.
 */
import type { PackSize, PackType } from '../engine/types';

import tileBasic1 from './assets/packs/T_BasicTilePack1.svg';
import tileBasic2 from './assets/packs/T_BasicTilePack2.svg';
import tileBasic3 from './assets/packs/T_BasicTilePack3.svg';
import tileBasic4 from './assets/packs/T_BasicTilePack4.svg';
import tileClassic1 from './assets/packs/T_ClassicTilePack1.svg';
import tileClassic2 from './assets/packs/T_ClassicTilePack2.svg';
import tilePremium1 from './assets/packs/T_PremiumTilePack1.svg';
import tilePremium2 from './assets/packs/T_PremiumTilePack2.svg';

import charmBasic1 from './assets/packs/T_BasicCharmPack.svg';
import charmBasic2 from './assets/packs/T_BasicCharmPack2.svg';
import charmClassic1 from './assets/packs/T_ClassicCharmPack.svg';
import charmPremium1 from './assets/packs/T_PremiumCharmPack.svg';

import fableBasic1 from './assets/packs/T_BasicFablePack1.svg';
import fableBasic2 from './assets/packs/T_BasicFablePack2.svg';
import fableBasic3 from './assets/packs/T_BasicFablePack3.svg';
import fableBasic4 from './assets/packs/T_BasicFablePack4.svg';
import fableClassic1 from './assets/packs/T_ClassicFablePack1.svg';
import fableClassic2 from './assets/packs/T_ClassicFablePack2.svg';
import fablePremium1 from './assets/packs/T_PremiumFablePack1.svg';
import fablePremium2 from './assets/packs/T_PremiumFablePack2.svg';

import constellationBasic1 from './assets/packs/T_BasicConstellationPack1.svg';
import constellationBasic2 from './assets/packs/T_BasicConstellationPack2.svg';
import constellationBasic3 from './assets/packs/T_BasicConstellationPack3.svg';
import constellationBasic4 from './assets/packs/T_BasicConstellationPack4.svg';
import constellationClassic1 from './assets/packs/T_ClassicConstellationPack1.svg';
import constellationClassic2 from './assets/packs/T_ClassicConstellationPack2.svg';
import constellationPremium1 from './assets/packs/T_PremiumConstellationPack1.svg';
import constellationPremium2 from './assets/packs/T_PremiumConstellationPack2.svg';

import inkBasic1 from './assets/packs/T_BasicInkPack1.svg';
import inkBasic2 from './assets/packs/T_BasicInkPack2.svg';
import inkClassic1 from './assets/packs/T_ClassicInkPack1.svg';
import inkPremium1 from './assets/packs/T_PremiumInkPack1.svg';

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

/** Image-only Collection pages, one per pack family. */
export function packGalleryPages(): PackGalleryEntry[][] {
  const pages: ReadonlyArray<{
    family: PackGalleryEntry['family'];
    art: Record<PackSize, readonly string[]>;
  }> = [
    { family: 'tile', art: PACK_ART.tile },
    { family: 'joker', art: PACK_ART.joker },
    { family: 'consumable', art: PACK_ART.consumable },
    { family: 'pattern', art: PACK_ART.pattern },
    { family: 'ink', art: PACK_ART.ink },
  ];

  return pages.map(({ family, art }) =>
    SIZE_ORDER.flatMap((size) =>
      art[size].map((src): PackGalleryEntry => ({ family, size, src })),
    ),
  );
}
