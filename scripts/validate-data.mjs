import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const table = JSON.parse(readFileSync(resolve(root, 'data/lexicon.json'), 'utf8'));
const dictionary = readFileSync(resolve(root, 'data/dictionary.txt'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const dictionaryTarget = 50000;
const suits = new Set(['standard', 'formal', 'slang', 'vulgar']);
const parts = new Set([
  'noun',
  'verbIntransitive',
  'verbTransitive',
  'verbLinking',
  'adjective',
  'adverb',
  'article',
  'conjunction',
  'preposition',
  'interjection',
]);

const errors = [];
if (dictionary.length !== dictionaryTarget) {
  errors.push(`dictionary: expected ${dictionaryTarget} words, found ${dictionary.length}`);
}
if (new Set(dictionary).size !== dictionary.length) {
  errors.push('dictionary: duplicate words');
}
if (dictionary.some((word) => !/^[a-z]+$/.test(word))) {
  errors.push('dictionary: invalid word');
}
if (dictionary.some((word, index) => index > 0 && dictionary[index - 1].localeCompare(word) > 0)) {
  errors.push('dictionary: words are not sorted');
}
for (const [word, entry] of Object.entries(table)) {
  if (!/^[a-z]+$/.test(word)) errors.push(`${word}: invalid key`);
  if (!entry || typeof entry !== 'object') {
    errors.push(`${word}: invalid entry`);
    continue;
  }
  if (!suits.has(entry.suit)) errors.push(`${word}: invalid suit ${entry.suit}`);
  if (!Array.isArray(entry.pos) || entry.pos.length === 0) {
    errors.push(`${word}: direct lexicon entry has no POS`);
    continue;
  }
  for (const pos of entry.pos) {
    if (!parts.has(pos)) errors.push(`${word}: invalid POS ${pos}`);
  }
}

if (errors.length > 0) {
  console.error(errors.slice(0, 20).join('\n'));
  console.error(`FAIL: ${errors.length} lexicon data error(s).`);
  process.exit(1);
}

console.log(`OK: ${dictionary.length} dictionary words and ${Object.keys(table).length} lexicon entries validated.`);
