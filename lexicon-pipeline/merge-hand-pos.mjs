#!/usr/bin/env node
/**
 * Merge hand-curated POS onto a scratch lexicon (legacy helper).
 *
 * `build-seeds-only.mjs` gives criteria-example SUIT coverage but only crude,
 * suffix-guessed POS. This overlays a hand-curated table's precise POS without
 * changing the register audit or adding words outside the active pool.
 *
 * Non-destructive and idempotent: the hand table wins only on POS.
 *
 * Usage:
 *   node merge-hand-pos.mjs --base data/lexicon.json --hand data/lexicon.curated.bak.json --out data/lexicon.json
 */

import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const BASE = args.base ?? 'data/lexicon.json';
const HAND = args.hand ?? 'data/lexicon.curated.bak.json';
const OUT = args.out ?? 'data/lexicon.json';
const MAX_WORD_LENGTH = 18;

const base = Object.fromEntries(
  Object.entries(JSON.parse(fs.readFileSync(BASE, 'utf8')))
    .filter(([word]) => word.length <= MAX_WORD_LENGTH),
);
const hand = JSON.parse(fs.readFileSync(HAND, 'utf8'));

let posOverlaid = 0;
for (const [w, h] of Object.entries(hand)) {
  if (w.startsWith('_')) continue; // skip `_comment` etc.
  const b = base[w];
  if (b && Array.isArray(h.pos) && h.pos.length) {
    b.pos = h.pos;
    posOverlaid++;
  }
}

fs.writeFileSync(OUT, JSON.stringify(base, null, 0));

const counts = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
for (const { suit } of Object.values(base)) counts[suit] = (counts[suit] ?? 0) + 1;
const total = Object.values(base).length;

console.log(
  `Merged ${OUT} — ${total} entries · POS overlaid on ${posOverlaid} words.`,
);
console.log('Suit distribution:');
for (const s of ['standard', 'formal', 'slang', 'vulgar']) {
  console.log(`  ${s.padEnd(9)} ${String(counts[s]).padStart(6)}  (${((counts[s] / total) * 100).toFixed(1)}%)`);
}
