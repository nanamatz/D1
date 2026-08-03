/**
 * Build the complete ENABLE validity dictionary plus tile-grammar exceptions.
 *
 * Usage: node scripts/build-dictionary.mjs <enable.txt> <out.txt>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , enablePath, outPath] = process.argv;
if (!enablePath || !outPath) {
  console.error('usage: build-dictionary.mjs <enable.txt> <out.txt>');
  process.exit(1);
}

const isWord = (word) => /^[a-z]+$/.test(word);
const words = new Set(
  readFileSync(enablePath, 'utf8')
    .split(/\r?\n/)
    .map((word) => word.trim().toLowerCase())
    .filter(isWord),
);

// Apostrophe-free grammar forms accepted by letter tiles even when ENABLE omits one.
for (const word of [
  'arent', 'cant', 'couldnt', 'didnt', 'doesnt', 'dont', 'hadnt', 'hasnt',
  'havent', 'isnt', 'shouldnt', 'wasnt', 'werent', 'wouldnt',
]) {
  words.add(word);
}

const sorted = [...words].sort();
const header = [
  '# Complete ENABLE word list plus apostrophe-free tile-grammar exceptions.',
  '# Source: ENABLE (dolph/dictionary). See data/README.md.',
  '# Regenerate: node scripts/build-dictionary.mjs <enable.txt> <out.txt>',
  '',
].join('\n');
writeFileSync(outPath, `${header}${sorted.join('\n')}\n`);
console.log(`wrote ${sorted.length} words to ${outPath}`);
