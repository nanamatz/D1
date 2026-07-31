import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const families = {
  Fable: Array.from({ length: 18 }, (_, index) => `T_Fable${index + 1}`),
  Constellation: [
    'Aquarius', 'Aries', 'Cancer', 'Capricorn', 'Gemini', 'Leo',
    'Libra', 'Pisces', 'Sagittarius', 'Scorpio', 'Taurus', 'Virgo',
  ],
  Gambler: [
    'BarnSwallow', 'Boar', 'Bridge', 'BushWarbler', 'Butterflies',
    'CraneAndSun', 'Cuckoo', 'Curtain', 'Deer', 'FullMoon', 'Geese',
    'Phoenix', 'Rainman', 'SakeCup',
  ],
};

for (const [family, names] of Object.entries(families)) {
  const directory = resolve(`docs/Arts/Cards/${family}/Vector`);
  for (const name of names) {
    const svgPath = resolve(directory, `${name}.svg`);
    const pngPath = resolve(directory, `${name}-preview.png`);
    if (!existsSync(svgPath) || !existsSync(pngPath)) {
      throw new Error(`Missing ${family} card art: ${name}`);
    }

    const svg = readFileSync(svgPath, 'utf8');
    if (
      !svg.includes('width="500" height="700"')
      || !svg.includes('<path ')
      || /<image|data:image|\.png/.test(svg)
    ) {
      throw new Error(`Invalid path-only SVG master: ${svgPath}`);
    }

    const png = PNG.sync.read(readFileSync(pngPath));
    if (png.width !== 500 || png.height !== 700) {
      throw new Error(`Invalid runtime PNG dimensions: ${pngPath}`);
    }
  }
}

console.log('Card assets OK: 44 SVG masters + 44 runtime PNG derivatives');
