/**
 * Generate the app icon and the web favicon from one source PNG.
 *
 * A .ico is an ICONDIR header plus one ICONDIRENTRY per size; since Vista each
 * entry may carry raw PNG bytes, so pngjs (already a devDependency) is enough.
 * The same file serves both targets — browsers read .ico favicons fine, and its
 * 256px entry covers high-DPI tabs.
 *
 * Usage: node scripts/make-icon.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const SOURCE = 'docs/Arts/Icons/AppIcon.png';
const OUTPUTS = ['desktop/icon.ico', 'public/favicon.ico'];
/** electron-builder requires a 256px entry; the smaller ones are for the taskbar and Explorer. */
const SIZES = [16, 32, 48, 256];

/** Pad to a centred square with transparency. */
function toSquare(src) {
  const side = Math.max(src.width, src.height);
  if (side === src.width && side === src.height) return src;

  const out = new PNG({ width: side, height: side });
  out.data.fill(0);
  const dx = Math.floor((side - src.width) / 2);
  const dy = Math.floor((side - src.height) / 2);

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      const d = ((y + dy) * side + (x + dx)) * 4;
      src.data.copy(out.data, d, s, s + 4);
    }
  }
  return out;
}

/** Box-average downscale. Nearest-neighbour speckles badly at a >4x reduction. */
function resize(src, size) {
  const out = new PNG({ width: size, height: size });
  const ratio = src.width / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * ratio);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * ratio));
      const y0 = Math.floor(y * ratio);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ratio));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4;
          const alpha = src.data[i + 3];
          // Weight colour by alpha so transparent pixels do not wash out the edges.
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }

      const d = (y * size + x) * 4;
      out.data[d] = a > 0 ? Math.round(r / a) : 0;
      out.data[d + 1] = a > 0 ? Math.round(g / a) : 0;
      out.data[d + 2] = a > 0 ? Math.round(b / a) : 0;
      out.data[d + 3] = Math.round(a / n);
    }
  }
  return out;
}

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;

  pngBuffers.forEach(({ size, data }, i) => {
    const e = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, e); // 0 means 256
    entries.writeUInt8(size >= 256 ? 0 : size, e + 1);
    entries.writeUInt8(0, e + 2); // palette count
    entries.writeUInt8(0, e + 3); // reserved
    entries.writeUInt16LE(1, e + 4); // colour planes
    entries.writeUInt16LE(32, e + 6); // bits per pixel
    entries.writeUInt32LE(data.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });

  return Buffer.concat([header, entries, ...pngBuffers.map((p) => p.data)]);
}

const source = toSquare(PNG.sync.read(readFileSync(SOURCE)));
const images = SIZES.map((size) => ({ size, data: PNG.sync.write(resize(source, size)) }));
const ico = buildIco(images);
for (const output of OUTPUTS) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, ico);
}
console.log(`Wrote ${OUTPUTS.join(', ')} (${SIZES.join(', ')}px) from ${SOURCE}`);
