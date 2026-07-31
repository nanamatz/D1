/**
 * Build display-sized Voucher art without touching the 1024px source masters.
 *
 * Runtime cards are 124x165px, so a 512px derivative keeps more than 3x pixel
 * density while avoiding ~29 MiB of oversized PNG payload. The 1024px masters
 * use transparency; average premultiplied colours to avoid dark edge halos.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SOURCE_DIR = path.resolve('docs/Arts/Voucher');
const OUTPUT_DIR = path.resolve('src/ui/assets/vouchers');

const LARGE_MASTERS = [
  'BlankPaper.png',
  'BWPhoto.png',
  'Catalog.png',
  'ComicBook.png',
  'FashionBook.png',
  'FashionMagazine.png',
  'Flyer.png',
  'HistoryBook.png',
  'KungfuManual.png',
  'Memo.png',
  'NewsPaper.png',
  'Notebook.png',
  'Novel.png',
  'OldBook.png',
  'WantedPoster.png',
  'YearBook.png',
  'ZeroScore.png',
];

function halfSize(source) {
  if (source.width !== 1024 || source.height !== 1024) {
    throw new Error(`Expected a 1024x1024 Voucher master, got ${source.width}x${source.height}`);
  }
  const output = new PNG({ width: 512, height: 512 });
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const target = (y * output.width + x) * 4;
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let oy = 0; oy < 2; oy += 1) {
        for (let ox = 0; ox < 2; ox += 1) {
          const sourceIndex = ((y * 2 + oy) * source.width + x * 2 + ox) * 4;
          const a = source.data[sourceIndex + 3];
          alpha += a;
          red += source.data[sourceIndex] * a;
          green += source.data[sourceIndex + 1] * a;
          blue += source.data[sourceIndex + 2] * a;
        }
      }
      output.data[target + 3] = Math.round(alpha / 4);
      if (alpha > 0) {
        output.data[target] = Math.round(red / alpha);
        output.data[target + 1] = Math.round(green / alpha);
        output.data[target + 2] = Math.round(blue / alpha);
      }
    }
  }
  return output;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const checkOnly = process.argv.includes('--check');
for (const fileName of LARGE_MASTERS) {
  const source = PNG.sync.read(readFileSync(path.join(SOURCE_DIR, fileName)));
  const output = PNG.sync.write(halfSize(source), {
    colorType: 6,
    deflateLevel: 9,
    deflateStrategy: 3,
  });
  const outputPath = path.join(OUTPUT_DIR, fileName);
  if (checkOnly) {
    let current;
    try {
      current = readFileSync(outputPath);
    } catch {
      throw new Error(`Missing Voucher derivative: ${fileName}`);
    }
    if (!current.equals(output)) throw new Error(`Stale Voucher derivative: ${fileName}`);
  } else {
    writeFileSync(outputPath, output);
  }
}

console.log(
  `${checkOnly ? 'Verified' : 'Built'} ${LARGE_MASTERS.length} Voucher derivatives at 512x512.`,
);
