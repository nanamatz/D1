/**
 * Deterministic pixel-art PNG → path-only SVG tracer.
 *
 * Usage:
 *   node scripts/trace-pixel-svg.mjs input.png output.svg
 *     [colors=32] [scale=2] [targetWidth] [targetHeight]
 *     [fit=contain|cover|stretch]
 *
 * The source is normalized onto an optional fixed canvas, box-sampled to a
 * logical pixel grid, and median-cut quantized. Equal horizontal runs are
 * merged vertically into rectangles. Rectangles of each palette color are
 * emitted as one SVG path; no raster <image> remains.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const [
  ,
  ,
  input,
  output,
  colorsArg = '32',
  scaleArg = '2',
  targetWidthArg,
  targetHeightArg,
  fitArg = 'contain',
] = process.argv;
if (!input || !output || extname(output).toLowerCase() !== '.svg') {
  throw new Error(
    'Usage: node scripts/trace-pixel-svg.mjs input.png output.svg '
      + '[colors] [scale] [targetWidth] [targetHeight] [fit]',
  );
}

const colorCount = Math.max(2, Number(colorsArg) || 24);
const scale = Math.max(1, Number(scaleArg) || 4);
const source = PNG.sync.read(readFileSync(input));
const targetWidth = Math.max(1, Number(targetWidthArg) || source.width);
const targetHeight = Math.max(1, Number(targetHeightArg) || source.height);
const fit = fitArg === 'cover' || fitArg === 'stretch' ? fitArg : 'contain';
const width = Math.ceil(targetWidth / scale);
const height = Math.ceil(targetHeight / scale);
const uniformFitScale = fit === 'cover'
  ? Math.max(targetWidth / source.width, targetHeight / source.height)
  : Math.min(targetWidth / source.width, targetHeight / source.height);
const fitScaleX = fit === 'stretch' ? targetWidth / source.width : uniformFitScale;
const fitScaleY = fit === 'stretch' ? targetHeight / source.height : uniformFitScale;
const fittedWidth = source.width * fitScaleX;
const fittedHeight = source.height * fitScaleY;
const offsetX = (targetWidth - fittedWidth) / 2;
const offsetY = (targetHeight - fittedHeight) / 2;

const pixels = [];
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let alpha = 0;
    let samples = 0;
    const tx0 = x * scale;
    const ty0 = y * scale;
    for (let ty = ty0; ty < Math.min(targetHeight, ty0 + scale); ty += 1) {
      for (let tx = tx0; tx < Math.min(targetWidth, tx0 + scale); tx += 1) {
        const sourceX = Math.floor((tx + 0.5 - offsetX) / fitScaleX);
        const sourceY = Math.floor((ty + 0.5 - offsetY) / fitScaleY);
        samples += 1;
        if (
          sourceX < 0
          || sourceX >= source.width
          || sourceY < 0
          || sourceY >= source.height
        ) {
          continue;
        }
        const offset = (sourceY * source.width + sourceX) * 4;
        const a = source.data[offset + 3] / 255;
        r += source.data[offset] * a;
        g += source.data[offset + 1] * a;
        b += source.data[offset + 2] * a;
        alpha += a;
      }
    }
    if (samples === 0 || alpha / samples < 0.15) {
      pixels.push(null);
    } else {
      pixels.push([
        Math.round(r / alpha),
        Math.round(g / alpha),
        Math.round(b / alpha),
      ]);
    }
  }
}

const opaque = pixels.filter(Boolean);
const channelRange = (items, channel) => {
  let min = 255;
  let max = 0;
  for (const pixel of items) {
    min = Math.min(min, pixel[channel]);
    max = Math.max(max, pixel[channel]);
  }
  return max - min;
};

let boxes = [opaque];
while (boxes.length < colorCount) {
  let splitIndex = -1;
  let splitChannel = 0;
  let bestRange = -1;
  boxes.forEach((box, index) => {
    if (box.length < 2) return;
    for (let channel = 0; channel < 3; channel += 1) {
      const range = channelRange(box, channel);
      if (range > bestRange) {
        bestRange = range;
        splitIndex = index;
        splitChannel = channel;
      }
    }
  });
  if (splitIndex < 0) break;
  const sorted = boxes[splitIndex].slice().sort((a, b) => a[splitChannel] - b[splitChannel]);
  const midpoint = Math.floor(sorted.length / 2);
  boxes.splice(splitIndex, 1, sorted.slice(0, midpoint), sorted.slice(midpoint));
}

const palette = boxes.map((box) => {
  const sum = box.reduce(
    (acc, pixel) => [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]],
    [0, 0, 0],
  );
  return sum.map((value) => Math.round(value / box.length));
});
const distance = (a, b) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const indexed = pixels.map((pixel) => {
  if (!pixel) return -1;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  palette.forEach((color, index) => {
    const next = distance(pixel, color);
    if (next < nearestDistance) {
      nearest = index;
      nearestDistance = next;
    }
  });
  return nearest;
});

const rectangles = Array.from({ length: palette.length }, () => []);
let active = new Map();
for (let y = 0; y < height; y += 1) {
  const rowRuns = [];
  let x = 0;
  while (x < width) {
    const color = indexed[y * width + x];
    if (color < 0) {
      x += 1;
      continue;
    }
    const start = x;
    while (x < width && indexed[y * width + x] === color) x += 1;
    rowRuns.push({ color, x: start, y, width: x - start, height: 1 });
  }
  const nextActive = new Map();
  for (const run of rowRuns) {
    const key = `${run.color}:${run.x}:${run.width}`;
    const previous = active.get(key);
    if (previous) {
      previous.height += 1;
      nextActive.set(key, previous);
    } else {
      nextActive.set(key, run);
    }
  }
  for (const [key, rect] of active) {
    if (!nextActive.has(key)) rectangles[rect.color].push(rect);
  }
  active = nextActive;
}
for (const rect of active.values()) rectangles[rect.color].push(rect);

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
const pathFor = (rects) =>
  rects.map((rect) =>
    `M${rect.x} ${rect.y}h${rect.width}v${rect.height}h-${rect.width}Z`,
  ).join('');

const paths = palette
  .map((color, index) => ({ color, rects: rectangles[index] }))
  .filter(({ rects }) => rects.length > 0)
  .sort((a, b) => a.rects.length - b.rects.length)
  .map(({ color, rects }) => `  <path fill="${hex(color)}" d="${pathFor(rects)}"/>`)
  .join('\n');

const svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">`,
  `  <title>${basename(input, extname(input))} vector trace</title>`,
  `  <desc>${colorCount}-color path trace from ${source.width}x${source.height} PNG; normalized to ${targetWidth}x${targetHeight}; logical grid ${width}x${height}; ${fit} fit.</desc>`,
  paths,
  '</svg>',
  '',
].join('\n');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, svg, 'utf8');

const preview = new PNG({ width: targetWidth, height: targetHeight });
for (let y = 0; y < preview.height; y += 1) {
  for (let x = 0; x < preview.width; x += 1) {
    const colorIndex = indexed[Math.floor(y / scale) * width + Math.floor(x / scale)];
    const offset = (y * preview.width + x) * 4;
    if (colorIndex < 0) {
      preview.data[offset + 3] = 0;
      continue;
    }
    const color = palette[colorIndex];
    preview.data[offset] = color[0];
    preview.data[offset + 1] = color[1];
    preview.data[offset + 2] = color[2];
    preview.data[offset + 3] = 255;
  }
}
const previewPath = output.replace(/\.svg$/i, '-preview.png');
writeFileSync(previewPath, PNG.sync.write(preview));
console.log(JSON.stringify({
  input,
  output,
  preview: previewPath,
  source: `${source.width}x${source.height}`,
  target: `${targetWidth}x${targetHeight}`,
  grid: `${width}x${height}`,
  fit,
  colors: palette.length,
  rectangles: rectangles.reduce((sum, group) => sum + group.length, 0),
}));
