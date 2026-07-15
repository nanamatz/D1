#!/usr/bin/env node
/**
 * Offline lexicon batch classifier for Play the Wor!d.
 *
 * Pipeline stage (GDD §3.2): curated word list -> seed lists + LLM batch -> baked lexicon.json
 * This is a DEV/OFFLINE tool. It is not part of the game runtime. Run it once (or when the
 * curated word list changes) and commit the resulting lexicon.json.
 *
 * What it does:
 *   1. Loads the curated word list (frequency-topped; one word per line).
 *   2. Applies the hand-written seed lists first (authoritative — never overridden by the LLM).
 *   3. Sends the REMAINING words to Claude in batches, asking for {suit, pos[]} per word.
 *   4. Cross-checks: if the model tags something the seeds already decided, seeds win.
 *   5. Writes lexicon.json = { word: { suit, pos[] } }.
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   node classify.mjs --words data/curated.txt --out data/lexicon.json [--limit 3000] [--model claude-sonnet-4-6]
 *
 * Notes:
 *   - Standard is the DEFAULT: words the model marks 'standard' just carry that; we don't
 *     need the model to be creative, only to catch formal/slang/vulgar. Keep temperature 0.
 *   - Inflected forms: tag at the lemma level upstream if possible; this script tags whatever
 *     words it is given. A separate inflection-inheritance step can map plurals/tenses to lemmas.
 *   - Resumable: it writes progress every batch, so a crash doesn't lose work.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------- arg parsing ----------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const WORDS_PATH = args.words ?? 'data/curated.txt';
const OUT_PATH = args.out ?? 'data/lexicon.json';
const SEED_DIR = args.seeds ?? 'seeds';
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const MODEL = args.model ?? 'claude-haiku-4-5-20251001'; // classification task — no need for Sonnet/Opus
const BATCH_SIZE = args.batch ? parseInt(args.batch, 10) : 100;

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ERROR: set ANTHROPIC_API_KEY in your environment.');
  process.exit(1);
}

// ---------- load inputs ----------
const readLines = (p) =>
  fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8').split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean)
    : [];

const words = [...new Set(readLines(WORDS_PATH))].slice(0, LIMIT);

const SUITS = ['formal', 'slang', 'vulgar'];
const seedMap = new Map(); // word -> suit
for (const suit of SUITS) {
  for (const w of readLines(path.join(SEED_DIR, `${suit}.txt`))) {
    seedMap.set(w, suit); // last write wins; order formal->slang->vulgar means vulgar overrides
  }
}

// resume from an existing partial output
let lexicon = {};
if (fs.existsSync(OUT_PATH)) {
  try { lexicon = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch { lexicon = {}; }
}

const POS_VALUES = [
  'noun', 'verbIntransitive', 'verbTransitive', 'verbLinking',
  'adjective', 'adverb', 'article', 'conjunction', 'preposition', 'interjection',
];

// ---------- prompt ----------
const SYSTEM = `You are a lexicographer tagging English words for a word game.
For each word return its register SUIT and its parts of speech.

SUIT — choose exactly one, using the "strongest register wins" rule:
- "vulgar": profanity, crude insults, or taboo words (even mild ones like "crap", "idiot").
- "slang": informal/colloquial words fine among friends but not in formal writing (e.g. "cool", "legit", "dude").
- "formal": academic, literary, or elevated words (e.g. "ubiquitous", "eschew").
- "standard": everything else — ordinary everyday vocabulary. This is the DEFAULT; most words are standard.
If a word has multiple registers, pick the strongest non-standard one that a typical speaker would recognize (vulgar > slang > formal > standard).

POS — list ALL that commonly apply, from this exact set:
${POS_VALUES.join(', ')}.
Use "verbTransitive"/"verbIntransitive"/"verbLinking" for verbs (a word can be several). "noun" covers pronouns.

Return ONLY a JSON array, no prose, no markdown fences. Each element:
{"word": "...", "suit": "...", "pos": ["...", ...]}
Preserve input order and spelling.`;

const userPrompt = (batch) =>
  `Tag these ${batch.length} words:\n${batch.map((w) => `- ${w}`).join('\n')}`;

// ---------- API call with retry ----------
async function classifyBatch(batch, attempt = 1) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        temperature: 0,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt(batch) }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) throw new Error('response was not a JSON array');
    return parsed;
  } catch (err) {
    if (attempt <= 4) {
      const wait = 2 ** attempt * 1000;
      console.warn(`  batch failed (attempt ${attempt}): ${err.message} — retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      return classifyBatch(batch, attempt + 1);
    }
    throw err;
  }
}

const validPos = (arr) =>
  Array.isArray(arr) && arr.length ? arr.filter((p) => POS_VALUES.includes(p)) : ['noun'];

// ---------- main ----------
const todo = words.filter((w) => !(w in lexicon));
console.log(`Words: ${words.length} | already done: ${words.length - todo.length} | seeds: ${seedMap.size}`);
console.log(`Classifying ${todo.length} words in batches of ${BATCH_SIZE} with ${MODEL}...`);

let processed = 0;
for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  const batch = todo.slice(i, i + BATCH_SIZE);
  let tagged;
  try {
    tagged = await classifyBatch(batch);
  } catch (err) {
    console.error(`FATAL on batch starting at ${i}: ${err.message}`);
    console.error('Progress saved; rerun to resume.');
    break;
  }

  const byWord = new Map(tagged.map((t) => [String(t.word).toLowerCase(), t]));
  for (const w of batch) {
    const t = byWord.get(w);
    const suit = seedMap.get(w) // seeds are authoritative
      ?? (t && SUITS.includes(t.suit) ? t.suit
        : t && t.suit === 'standard' ? 'standard'
        : 'standard');
    lexicon[w] = { suit, pos: validPos(t?.pos) };
  }

  processed += batch.length;
  fs.writeFileSync(OUT_PATH, JSON.stringify(lexicon, null, 0));
  const pct = ((processed / todo.length) * 100).toFixed(1);
  process.stdout.write(`\r  ${processed}/${todo.length} (${pct}%)   `);
}

// ---------- fold in any seed words not in the curated list ----------
for (const [w, suit] of seedMap) {
  if (!(w in lexicon)) lexicon[w] = { suit, pos: ['noun'] }; // pos unknown; default noun
}
fs.writeFileSync(OUT_PATH, JSON.stringify(lexicon, null, 0));

// ---------- report ----------
const counts = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
for (const { suit } of Object.values(lexicon)) counts[suit] = (counts[suit] ?? 0) + 1;
const total = Object.values(lexicon).length;
console.log(`\n\nDone. lexicon.json = ${total} entries.`);
console.log('Suit distribution:');
for (const s of ['standard', 'formal', 'slang', 'vulgar']) {
  const n = counts[s];
  console.log(`  ${s.padEnd(9)} ${String(n).padStart(6)}  (${((n / total) * 100).toFixed(1)}%)`);
}
console.log('\nRemember: this is an offline artifact. Commit lexicon.json; do not run at game runtime.');
