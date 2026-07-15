#!/usr/bin/env node
/**
 * Merge hand-curated POS onto a seeds-only lexicon (playtest follow-up).
 *
 * `build-seeds-only.mjs` gives broad SUIT coverage (516 seeds) but only crude,
 * suffix-guessed POS. This overlays a hand-curated table's precise POS (and its
 * hand-tagged suits where the seed pass left a word `standard`) so the
 * pattern-example words spell out real parts of speech, while the seeds stay
 * authoritative for any non-standard suit they already assigned.
 *
 * Non-destructive and idempotent: seeds win on suit; hand table wins on POS.
 * A later `classify.mjs` run replaces the remaining crude guesses.
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

const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const hand = JSON.parse(fs.readFileSync(HAND, 'utf8'));

let posOverlaid = 0;
let suitAdded = 0;
let addedWords = 0;

for (const [w, h] of Object.entries(hand)) {
  if (w.startsWith('_')) continue; // skip `_comment` etc.
  const b = base[w];
  if (b) {
    // POS: the hand table is authoritative (precise, multi-POS).
    if (Array.isArray(h.pos) && h.pos.length) {
      b.pos = h.pos;
      posOverlaid++;
    }
    // Suit: seeds win on non-standard; only fill in where seeds left it standard.
    if (b.suit === 'standard' && h.suit && h.suit !== 'standard') {
      b.suit = h.suit;
      suitAdded++;
    }
  } else {
    // Hand word not in the base dictionary — keep it available (seeds-only did too).
    base[w] = { suit: h.suit ?? 'standard', pos: h.pos ?? ['noun'] };
    addedWords++;
  }
}

fs.writeFileSync(OUT, JSON.stringify(base, null, 0));

const counts = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
for (const { suit } of Object.values(base)) counts[suit] = (counts[suit] ?? 0) + 1;
const total = Object.values(base).length;

console.log(
  `Merged ${OUT} — ${total} entries · POS overlaid on ${posOverlaid} words · ` +
    `${suitAdded} hand suits filled in · ${addedWords} hand-only words added.`,
);
console.log('Suit distribution:');
for (const s of ['standard', 'formal', 'slang', 'vulgar']) {
  console.log(`  ${s.padEnd(9)} ${String(counts[s]).padStart(6)}  (${((counts[s] / total) * 100).toFixed(1)}%)`);
}
