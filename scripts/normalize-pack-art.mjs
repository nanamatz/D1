/**
 * Normalize card-pack art to a single aspect ratio.
 *
 * The source pack PNGs (docs/Arts/CardPacks) are hand-drawn at slightly different
 * ratios (~0.59–0.63 w/h), so `object-fit: contain` renders them at inconsistent
 * sizes. This pads each with TRANSPARENT margins (centered — no scaling, no crop,
 * no distortion) to TARGET_RATIO and writes the result to the bundled runtime copy
 * under src/ui/assets/packs. Re-run whenever the source art changes:
 *
 *   node scripts/normalize-pack-art.mjs
 */
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'docs/Arts/CardPacks';
const OUT = 'src/ui/assets/packs';
const TARGET_RATIO = 0.61; // width / height — the common pack proportion

fs.mkdirSync(OUT, { recursive: true });

for (const file of fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'))) {
  const png = PNG.sync.read(fs.readFileSync(path.join(SRC, file)));
  const { width: w, height: h } = png;
  const r = w / h;

  let nw = w;
  let nh = h;
  if (r < TARGET_RATIO) nw = Math.round(h * TARGET_RATIO); // too narrow → pad width
  else if (r > TARGET_RATIO) nh = Math.round(w / TARGET_RATIO); // too wide → pad height

  const out = new PNG({ width: nw, height: nh }); // Buffer.alloc → fully transparent
  const dx = Math.floor((nw - w) / 2);
  const dy = Math.floor((nh - h) / 2);
  PNG.bitblt(png, out, 0, 0, w, h, dx, dy); // center the original, unchanged

  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(out));
  console.log(
    `${file.padEnd(22)} ${w}x${h} (${r.toFixed(3)}) -> ${nw}x${nh} (${(nw / nh).toFixed(3)})`,
  );
}
console.log(`\nDone — all packs padded to ratio ${TARGET_RATIO}.`);
