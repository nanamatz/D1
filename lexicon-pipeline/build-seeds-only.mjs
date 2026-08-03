#!/usr/bin/env node
/**
 * Criteria-examples-only lexicon builder (no API call, no cost).
 *
 * Applies the classification document's explicit examples to a word list and
 * defaults everything else to Standard. This is a legacy scratch-table helper;
 * it is not the canonical full audit.
 *
 * POS is not known for non-example words in this mode; they get a best-effort
 * guess (see guessPos below) so pattern matching has something to work with.
 * Re-run the canonical register pipeline later to replace the fallback table.
 *
 * Usage:
 *   node build-seeds-only.mjs --words data/curated.txt --out data/lexicon.json
 */

import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const WORDS_PATH = args.words ?? 'data/curated.txt';
const OUT_PATH = args.out ?? 'data/lexicon.json';
const OVERRIDES_PATH = args.overrides ?? 'lexicon-pipeline/register-overrides.json';

const readLines = (p) =>
  fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean)
    : [];

const words = [...new Set(readLines(WORDS_PATH))];
if (words.length === 0) {
  console.error(`No words found at ${WORDS_PATH}. Point --words at your curated word list.`);
  process.exit(1);
}

const SUITS = ['standard', 'formal', 'slang', 'vulgar'];
const criteriaMap = new Map();
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
for (const suit of SUITS) {
  for (const word of overrides[suit] ?? []) criteriaMap.set(word, suit);
}

// Crude best-effort POS guess so the sentence system has something to match
// until the canonical POS builder replaces it.
function guessPos(word) {
  if (/(ly)$/.test(word)) return ['adverb'];
  if (/(ing|ate|ize|ify|ed)$/.test(word)) return ['verbTransitive', 'verbIntransitive'];
  if (/(ous|ful|ive|able|ible|al|ic)$/.test(word)) return ['adjective'];
  return ['noun'];
}

const lexicon = {};
let exampleHits = 0;
for (const w of words) {
  const suit = criteriaMap.get(w) ?? 'standard';
  if (criteriaMap.has(w)) exampleHits++;
  lexicon[w] = { suit, pos: guessPos(w) };
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(lexicon, null, 0));

const counts = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
for (const { suit } of Object.values(lexicon)) counts[suit]++;
const total = Object.values(lexicon).length;

console.log(`Wrote ${OUT_PATH} — ${total} entries (${exampleHits} matched a criteria example, ${total - exampleHits} defaulted to Standard).`);
console.log('Suit distribution:');
for (const s of ['standard', 'formal', 'slang', 'vulgar']) {
  console.log(`  ${s.padEnd(9)} ${String(counts[s]).padStart(6)}  (${((counts[s] / total) * 100).toFixed(1)}%)`);
}
console.log('\nNo API calls made. Re-run the canonical Wiktionary register pipeline for the full audit.');
