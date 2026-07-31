/**
 * Build the curated validity dictionary (playtest-01 P0-1).
 *
 *   node scripts/build-dictionary.mjs <enable.txt> <count_1w.txt> <out.txt> [limit]
 *
 * Output = the top-`limit` most frequent words (Norvig Google-corpus counts)
 * that are also valid ENABLE words — so common words + their inflections stay in
 * (Scrabble convention) while junk/proper-noun frequency entries are dropped.
 * Tile-grammar words missing from ENABLE are force-included.
 *
 * Sources (permissive/public domain), fetched offline:
 *   ENABLE:  https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
 *   counts:  https://norvig.com/ngrams/count_1w.txt
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , enablePath, freqPath, outPath, limitArg] = process.argv;
if (!enablePath || !freqPath || !outPath) {
  console.error('usage: build-dictionary.mjs <enable> <count_1w> <out> [limit]');
  process.exit(1);
}
const limit = Number(limitArg ?? 50000);

const isWord = (w) => /^[a-z]+$/.test(w);

const valid = new Set(
  readFileSync(enablePath, 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter(isWord),
);

const selected = new Set([
  'a',
  'i',
  'arent',
  'cant',
  'couldnt',
  'didnt',
  'doesnt',
  'dont',
  'hadnt',
  'hasnt',
  'havent',
  'isnt',
  'shouldnt',
  'wasnt',
  'werent',
  'wouldnt',
]);
for (const line of readFileSync(freqPath, 'utf8').split(/\r?\n/)) {
  if (selected.size >= limit) break;
  const word = line.split('\t')[0]?.trim().toLowerCase();
  if (word && isWord(word) && valid.has(word)) selected.add(word);
}

const words = [...selected].sort();
const header = [
  '# Curated validity dictionary (playtest-01 P0-1).',
  '# ENABLE ∩ top-frequency (Norvig count_1w); inflected forms included.',
  '# Regenerate: node scripts/build-dictionary.mjs <enable> <count_1w> <out> [limit]',
  '',
].join('\n');
writeFileSync(outPath, header + words.join('\n') + '\n');
console.log(`wrote ${words.length} words to ${outPath}`);
