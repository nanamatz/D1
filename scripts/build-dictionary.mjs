/**
 * Build the playable ENABLE validity dictionary plus tile-grammar exceptions.
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
const MAX_WORD_LENGTH = 18;
const curated = JSON.parse(readFileSync(
  new URL('../lexicon-pipeline/curated-abbreviations.json', import.meta.url),
  'utf8',
));
const words = new Set(
  readFileSync(enablePath, 'utf8')
    .split(/\r?\n/)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => isWord(word) && word.length <= MAX_WORD_LENGTH),
);

// Apostrophe-free grammar forms accepted by letter tiles even when ENABLE omits one.
for (const word of [
  'arent', 'cant', 'couldnt', 'didnt', 'doesnt', 'dont', 'hadnt', 'hasnt',
  'havent', 'isnt', 'shouldnt', 'wasnt', 'werent', 'wouldnt',
]) {
  if (word.length <= MAX_WORD_LENGTH) words.add(word);
}
for (const { word } of curated) words.add(word);

const sorted = [...words].sort();
const header = [
  `# ENABLE words up to ${MAX_WORD_LENGTH} letters plus tile-grammar exceptions and curated abbreviations.`,
  '# Sources: ENABLE (dolph/dictionary) and lexicon-pipeline/curated-abbreviations.json.',
  '# Regenerate: node scripts/build-dictionary.mjs <enable.txt> <out.txt>',
  '',
].join('\n');
writeFileSync(outPath, `${header}${sorted.join('\n')}\n`);
console.log(`wrote ${sorted.length} words to ${outPath}`);
