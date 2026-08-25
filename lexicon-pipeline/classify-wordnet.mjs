#!/usr/bin/env node
/**
 * Fill every dictionary word with POS using Princeton WordNet 3.0.
 * Existing baked tags are enriched with exact-headword source tags; explicit
 * POS overrides remain authoritative. WordNet morphology fills missing words.
 *
 * Usage:
 *   node classify-wordnet.mjs --words ../data/dictionary.txt \
 *     --existing ../data/lexicon.json --wordnet /path/to/WordNet-3.0/dict \
 *     --moby /path/to/mobypos.txt \
 *     --out ../data/lexicon.json
 */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
const WORDS = args.words ?? '../data/dictionary.txt';
const EXISTING = args.existing ?? '../data/lexicon.json';
const WORDNET = args.wordnet;
const MOBY = args.moby;
const OUT = args.out ?? EXISTING;
const POS_OVERRIDES = args.posOverrides ?? 'lexicon-pipeline/pos-overrides.json';
const CURATED = args.curated ?? 'lexicon-pipeline/curated-abbreviations.json';
const MAX_WORD_LENGTH = 18;

if (!WORDNET || !MOBY) {
  console.error('usage: add --wordnet /path/to/WordNet-3.0/dict --moby /path/to/mobypos.txt');
  process.exit(1);
}

const readLines = (file) => fs.readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const eligible = (word) => word.length <= MAX_WORD_LENGTH;
const dictionary = [...new Set(readLines(WORDS).filter(eligible))];
const existing = fs.existsSync(EXISTING)
  ? Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(EXISTING, 'utf8')))
    .filter(([word]) => eligible(word)))
  : {};
const posOverrides = fs.existsSync(POS_OVERRIDES)
  ? JSON.parse(fs.readFileSync(POS_OVERRIDES, 'utf8'))
  : {};
const curated = JSON.parse(fs.readFileSync(CURATED, 'utf8'));

const wordnet = new Map();
const moby = new Map();
const entry = (word) => {
  const key = word.toLowerCase().replace(/\(.+\)$/, '');
  if (!/^[a-z]+$/.test(key)) return null;
  if (!wordnet.has(key)) {
    wordnet.set(key, { noun: false, adjective: false, adverb: false, frames: new Set() });
  }
  return wordnet.get(key);
};

function loadData(kind, filename) {
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    if (!/^\d/.test(line)) continue;
    const tokens = line.split('|', 1)[0].trim().split(/\s+/);
    const wordCount = Number.parseInt(tokens[3], 16);
    const words = [];
    for (let index = 0; index < wordCount; index += 1) {
      words.push(tokens[4 + index * 2]);
    }
    if (kind !== 'verb') {
      for (const word of words) {
        const target = entry(word);
        if (target) target[kind] = true;
      }
      continue;
    }

    let cursor = 4 + wordCount * 2;
    const pointerCount = Number(tokens[cursor]);
    cursor += 1 + pointerCount * 4;
    const frameCount = Number(tokens[cursor] ?? 0);
    cursor += 1;
    const frames = [];
    for (let index = 0; index < frameCount; index += 1) {
      const frame = Number(tokens[cursor + 1]);
      const wordIndex = Number.parseInt(tokens[cursor + 2], 16);
      frames.push({ frame, wordIndex });
      cursor += 3;
    }
    words.forEach((word, index) => {
      const target = entry(word);
      if (!target) return;
      for (const { frame, wordIndex } of frames) {
        if (wordIndex === 0 || wordIndex === index + 1) target.frames.add(frame);
      }
    });
  }
}

loadData('noun', path.join(WORDNET, 'data.noun'));
loadData('adjective', path.join(WORDNET, 'data.adj'));
loadData('adverb', path.join(WORDNET, 'data.adv'));
loadData('verb', path.join(WORDNET, 'data.verb'));

const mobyCodes = {
  N: 'noun', p: 'noun', h: 'noun', r: 'noun', o: 'noun',
  t: 'verbTransitive', i: 'verbIntransitive', A: 'adjective', v: 'adverb',
  C: 'conjunction', P: 'preposition', '!': 'interjection', D: 'article', I: 'article',
};
for (const line of fs.readFileSync(MOBY, 'utf8').split(/\r?\n/)) {
  const delimiter = line.lastIndexOf('\\');
  if (delimiter < 1) continue;
  const word = line.slice(0, delimiter).toLowerCase();
  if (!/^[a-z]+$/.test(word)) continue;
  const codes = line.slice(delimiter + 1);
  const pos = new Set([...codes].map((code) => mobyCodes[code]).filter(Boolean));
  const genericVerb = codes.includes('V') && !codes.includes('t') && !codes.includes('i');
  const current = moby.get(word) ?? { pos: new Set(), genericVerb: false };
  for (const value of pos) current.pos.add(value);
  current.genericVerb ||= genericVerb;
  moby.set(word, current);
}

const exceptions = new Map();
for (const [kind, file] of [
  ['noun', 'noun.exc'], ['verb', 'verb.exc'], ['adjective', 'adj.exc'], ['adverb', 'adv.exc'],
]) {
  for (const line of readLines(path.join(WORDNET, file))) {
    const [form, ...lemmas] = line.split(/\s+/);
    const key = `${kind}:${form}`;
    exceptions.set(key, lemmas);
  }
}

const suffixes = {
  noun: [['s', ''], ['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'], ['men', 'man'], ['ies', 'y']],
  verb: [['s', ''], ['ies', 'y'], ['es', 'e'], ['es', ''], ['ed', 'e'], ['ed', ''], ['ing', 'e'], ['ing', '']],
  adjective: [['er', ''], ['est', ''], ['er', 'e'], ['est', 'e']],
  adverb: [],
};

function candidates(word, kind) {
  const found = new Set([word]);
  for (const lemma of exceptions.get(`${kind}:${word}`) ?? []) found.add(lemma);
  for (const [ending, replacement] of suffixes[kind]) {
    if (word.endsWith(ending)) found.add(word.slice(0, -ending.length) + replacement);
  }
  return [...found];
}

const transitiveFrames = new Set([5, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 26, 29, 30, 31, 33]);
const linkingFrames = new Set([6, 7]);
const POS_ORDER = [
  'noun', 'verbIntransitive', 'verbTransitive', 'verbLinking', 'adjective', 'adverb',
  'article', 'conjunction', 'preposition', 'interjection',
];

/** Direct labels only: no suffix/lemma inference, so legacy tags gain only
 * POS explicitly attached to the same spelling in Moby or WordNet. */
function exactFromSources(word) {
  const pos = new Set(moby.get(word)?.pos ?? []);
  const data = wordnet.get(word);
  if (data?.noun) pos.add('noun');
  if (data?.adjective) pos.add('adjective');
  if (data?.adverb) pos.add('adverb');
  if (data?.frames.size) {
    const frames = [...data.frames];
    if (frames.some((frame) => linkingFrames.has(frame))) pos.add('verbLinking');
    if (frames.some((frame) => transitiveFrames.has(frame))) pos.add('verbTransitive');
    if (frames.some((frame) => !linkingFrames.has(frame) && !transitiveFrames.has(frame))) {
      pos.add('verbIntransitive');
    }
  }
  return POS_ORDER.filter((value) => pos.has(value));
}

function fromSources(word) {
  const mobyEntry = moby.get(word);
  const pos = new Set(mobyEntry?.pos ?? []);
  let foundMoby = !!mobyEntry;
  let genericMobyVerb = mobyEntry?.genericVerb ?? false;
  for (const kind of ['noun', 'verb', 'adjective', 'adverb']) {
    for (const candidate of candidates(word, kind)) {
      const derived = moby.get(candidate);
      if (!derived) continue;
      if (kind === 'verb') {
        const verbPos = [...derived.pos].filter((value) => value.startsWith('verb'));
        if (verbPos.length || derived.genericVerb) foundMoby = true;
        for (const value of verbPos) pos.add(value);
        genericMobyVerb ||= derived.genericVerb;
      } else if (derived.pos.has(kind)) {
        foundMoby = true;
        pos.add(kind);
      }
    }
  }
  let found = false;
  for (const kind of ['noun', 'verb', 'adjective', 'adverb']) {
    for (const candidate of candidates(word, kind)) {
      const data = wordnet.get(candidate);
      if (!data) continue;
      if (kind !== 'verb' && data[kind]) {
        pos.add(kind);
        found = true;
      }
      if (kind === 'verb' && data.frames.size > 0) {
        found = true;
        const frames = [...data.frames];
        if (frames.some((frame) => linkingFrames.has(frame))) pos.add('verbLinking');
        if (frames.some((frame) => transitiveFrames.has(frame))) pos.add('verbTransitive');
        if (frames.some((frame) => !linkingFrames.has(frame) && !transitiveFrames.has(frame))) {
          pos.add('verbIntransitive');
        }
      }
    }
  }
  if (genericMobyVerb && ![...pos].some((value) => value.startsWith('verb'))) {
    pos.add('verbIntransitive');
    pos.add('verbTransitive');
  }
  return {
    pos: POS_ORDER.filter((value) => pos.has(value)),
    moby: foundMoby,
    wordnet: found,
  };
}

function fallback(word) {
  if (/ly$/.test(word)) return ['adverb'];
  if (/(ous|ful|less|ive|able|ible|al|ic|ish|ary|ory|ent|ant)$/.test(word)) return ['adjective'];
  if (/(ing|ate|ize|ise|ify|ed|en)$/.test(word)) return ['verbIntransitive', 'verbTransitive'];
  return ['noun'];
}

const output = { ...existing };
let preserved = 0;
let enriched = 0;
let mobyClassified = 0;
let wordnetClassified = 0;
let guessed = 0;
for (const word of dictionary) {
  if (output[word]?.pos?.length) {
    const pos = [
      ...output[word].pos,
      ...exactFromSources(word).filter((value) => !output[word].pos.includes(value)),
    ];
    if (pos.length > output[word].pos.length) enriched += 1;
    output[word] = { ...output[word], pos };
    preserved += 1;
    continue;
  }
  const inferred = fromSources(word);
  if (inferred.moby) mobyClassified += 1;
  else if (inferred.wordnet) wordnetClassified += 1;
  else guessed += 1;
  output[word] = {
    // Register is assigned by classify-registers.mjs after POS is complete.
    suit: 'standard',
    pos: inferred.pos.length ? inferred.pos : fallback(word),
  };
}

for (const [word, pos] of Object.entries(posOverrides)) {
  if (!output[word] || !Array.isArray(pos) || pos.length === 0) continue;
  output[word] = { ...output[word], pos: POS_ORDER.filter((value) => pos.includes(value)) };
}
for (const entry of curated) {
  if (!dictionary.includes(entry.word)) {
    throw new Error(`curated abbreviation missing from dictionary: ${entry.word}`);
  }
  output[entry.word] = { suit: entry.suit, pos: entry.pos };
}

const sorted = Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT, JSON.stringify(sorted));
console.log(`wrote ${Object.keys(sorted).length} entries to ${OUT}`);
console.log(`preserved ${preserved} (${enriched} enriched); Moby ${mobyClassified}; WordNet-only ${wordnetClassified}; fallback ${guessed}; overrides ${Object.keys(posOverrides).length}`);
