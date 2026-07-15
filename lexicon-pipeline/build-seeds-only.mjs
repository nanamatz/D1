#!/usr/bin/env node
/**
 * Seeds-only lexicon builder (no API call, no cost).
 *
 * Applies the hand-written seed lists to the curated word list and defaults
 * everything else to 'standard'. This is step ① of the pipeline on its own —
 * a fast, free way to relieve the "everything is Standard" playtest complaint
 * before spending anything on the LLM batch (classify.mjs).
 *
 * POS is not known for non-seeded words in this mode; they get a best-effort
 * guess (see guessPos below) so pattern matching has something to work with.
 * Re-run classify.mjs later to replace these with real LLM tagging — seeds
 * always win either way, so nothing here needs to be redone.
 *
 * Usage:
 *   node build-seeds-only.mjs --words data/curated.txt --out data/lexicon.json --seeds seeds
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
const SEED_DIR = args.seeds ?? 'seeds';

const readLines = (p) =>
  fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean)
    : [];

const words = [...new Set(readLines(WORDS_PATH))];
if (words.length === 0) {
  console.error(`No words found at ${WORDS_PATH}. Point --words at your curated word list.`);
  process.exit(1);
}

const SUITS = ['formal', 'slang', 'vulgar']; // loaded in this order; later entries win on overlap
const seedMap = new Map();
for (const suit of SUITS) {
  const list = readLines(path.join(SEED_DIR, `${suit}.txt`));
  for (const w of list) seedMap.set(w, suit);
}

// crude best-effort POS guess for un-seeded words, so the sentence system has
// *something* to match against until the real classify.mjs run replaces it.
function guessPos(word) {
  if (/(ly)$/.test(word)) return ['adverb'];
  if (/(ing|ate|ize|ify|ed)$/.test(word)) return ['verbTransitive', 'verbIntransitive'];
  if (/(ous|ful|ive|able|ible|al|ic)$/.test(word)) return ['adjective'];
  return ['noun'];
}

const lexicon = {};
let seededHits = 0;
for (const w of words) {
  const suit = seedMap.get(w) ?? 'standard';
  if (seedMap.has(w)) seededHits++;
  lexicon[w] = { suit, pos: guessPos(w) };
}
// fold in seed words not present in the curated list (rare, but keep them available)
for (const [w, suit] of seedMap) {
  if (!(w in lexicon)) lexicon[w] = { suit, pos: guessPos(w) };
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(lexicon, null, 0));

const counts = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
for (const { suit } of Object.values(lexicon)) counts[suit]++;
const total = Object.values(lexicon).length;

console.log(`Wrote ${OUT_PATH} — ${total} entries (${seededHits} matched a seed, ${total - seededHits} defaulted to standard).`);
console.log('Suit distribution:');
for (const s of ['standard', 'formal', 'slang', 'vulgar']) {
  console.log(`  ${s.padEnd(9)} ${String(counts[s]).padStart(6)}  (${((counts[s] / total) * 100).toFixed(1)}%)`);
}
console.log('\nNo API calls made — this is free. Re-run classify.mjs later for full LLM tagging (seeds are preserved either way).');
