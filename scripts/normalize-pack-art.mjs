/**
 * Normalize every supplied pack PNG into the runtime path-only SVG standard.
 *
 * Output: 244×400 (ratio 0.61), 122×200 logical grid, 32 colors, stretch fit.
 * Source PNGs remain in docs/Arts/CardPacks; runtime imports use only SVG.
 *
 * Usage:
 *   npm run normalize:packs
 */
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SOURCE = 'docs/Arts/CardPacks';
const OUTPUT = 'src/ui/assets/packs';
const TRACE = 'scripts/trace-pixel-svg.mjs';

const FILES = {
  'Tile/T_BasicTilePack.png': 'T_BasicTilePack1.svg',
  'Tile/T_BasicTilePack (2).png': 'T_BasicTilePack2.svg',
  'Tile/T_BasicTilePack (3).png': 'T_BasicTilePack3.svg',
  'Tile/T_BasicTilePack (4).png': 'T_BasicTilePack4.svg',
  'Tile/T_ClassicTilePack.png': 'T_ClassicTilePack1.svg',
  'Tile/T_ClassicTilePack (2).png': 'T_ClassicTilePack2.svg',
  'Tile/T_PremiumTilePack.png': 'T_PremiumTilePack1.svg',
  'Tile/T_PremiumTilePack (2).png': 'T_PremiumTilePack2.svg',
  'Charm/T_BasicCharmPack.png': 'T_BasicCharmPack.svg',
  'Charm/T_BasicCharmPack2.png': 'T_BasicCharmPack2.svg',
  'Charm/T_ClassicCharmPack.png': 'T_ClassicCharmPack.svg',
  'Charm/T_PremiumCharmPack.png': 'T_PremiumCharmPack.svg',
  'Fable/Basic.png': 'T_BasicFablePack1.svg',
  'Fable/Basic2.png': 'T_BasicFablePack2.svg',
  'Fable/Basic3.png': 'T_BasicFablePack3.svg',
  'Fable/Basic4.png': 'T_BasicFablePack4.svg',
  'Fable/Classic1.png': 'T_ClassicFablePack1.svg',
  'Fable/Classic2.png': 'T_ClassicFablePack2.svg',
  'Fable/Premium1.png': 'T_PremiumFablePack1.svg',
  'Fable/Premium2.png': 'T_PremiumFablePack2.svg',
  'Star/T_BasicStarPack.png': 'T_BasicConstellationPack1.svg',
  'Star/T_BasicStarPack2.png': 'T_BasicConstellationPack2.svg',
  'Star/T_BasicStarPack3.png': 'T_BasicConstellationPack3.svg',
  'Star/T_BasicStarPack4.png': 'T_BasicConstellationPack4.svg',
  'Star/T_ClassicStarPack.png': 'T_ClassicConstellationPack1.svg',
  'Star/T_ClassicStarPack2.png': 'T_ClassicConstellationPack2.svg',
  'Star/T_PremiumStarPack.png': 'T_PremiumConstellationPack1.svg',
  'Star/T_PremiumStarPack2.png': 'T_PremiumConstellationPack2.svg',
  'Ink/T_BasicInkPack1.png': 'T_BasicInkPack1.svg',
  'Ink/T_BasicInkPack2.png': 'T_BasicInkPack2.svg',
  'Ink/T_ClassicInkPack.png': 'T_ClassicInkPack1.svg',
  'Ink/T_PremiumInkPack.png': 'T_PremiumInkPack1.svg',
};

const expectedOutputs = new Set(Object.values(FILES));
for (const file of readdirSync(OUTPUT)) {
  if (file.endsWith('.svg') && !expectedOutputs.has(file)) {
    unlinkSync(path.join(OUTPUT, file));
  }
}

for (const [sourceName, outputName] of Object.entries(FILES)) {
  const input = path.join(SOURCE, sourceName);
  const output = path.join(OUTPUT, outputName);
  const result = spawnSync(
    process.execPath,
    [TRACE, input, output, '32', '2', '244', '400', 'stretch'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to trace pack artwork: ${sourceName}`);
  }

  const preview = output.replace(/\.svg$/i, '-preview.png');
  if (existsSync(preview)) unlinkSync(preview);
}

console.log(`Normalized ${Object.keys(FILES).length} pack artworks to path-only SVG.`);
