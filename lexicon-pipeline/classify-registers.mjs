#!/usr/bin/env node
/**
 * Reclassify every baked word by the project's representative-meaning rules.
 * First-sense dictionary labels and explicit criteria examples are direct;
 * unclassified words default to Standard. POS-compatible inflections inherit.
 */
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);

const LEXICON = args.lexicon ?? 'data/lexicon.json';
const PRIMARY = args.primary ?? 'lexicon-pipeline/wiktionary-primary-registers.json';
const OVERRIDES = args.overrides ?? 'lexicon-pipeline/register-overrides.json';
const OUT = args.out ?? LEXICON;
const AUDIT = args.audit ?? 'data/register-audit.json';
const MAX_WORD_LENGTH = 18;
const SUITS = ['standard', 'formal', 'slang', 'vulgar'];
const STRENGTH = Object.fromEntries(SUITS.map((suit, index) => [suit, index]));

const lexicon = Object.fromEntries(
  Object.entries(JSON.parse(fs.readFileSync(LEXICON, 'utf8')))
    .filter(([word]) => word.length <= MAX_WORD_LENGTH),
);
const primary = JSON.parse(fs.readFileSync(PRIMARY, 'utf8'));
const overrides = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
const decisions = new Map();

for (const [word, entry] of Object.entries(primary.words)) {
  if (word.length > MAX_WORD_LENGTH) continue;
  decisions.set(word, {
    suit: entry.register,
    assignment: 'primary-sense',
    sources: [`wiktionary:first-sense:${entry.labels.join(',') || 'unmarked'}`],
  });
}
for (const suit of SUITS) {
  for (const word of overrides[suit] ?? []) {
    if (!Object.hasOwn(lexicon, word)) continue;
    const current = decisions.get(word);
    decisions.set(word, {
      suit,
      assignment: 'criteria-example',
      sources: [...new Set([...(current?.sources ?? []), 'criteria:explicit-example'])],
    });
  }
}

const broadPos = (entry) => new Set(entry.pos.map((pos) => (
  pos.startsWith('verb') ? 'verb' : pos
)));

function lemmaCandidates(word) {
  const found = [];
  const add = (lemma, kind) => {
    if (lemma.length >= 2 && lemma !== word) found.push({ lemma, kind });
  };

  if (word.endsWith('men')) add(`${word.slice(0, -3)}man`, 'noun');
  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`, 'noun');
  if (word.endsWith('ves')) {
    add(`${word.slice(0, -3)}f`, 'noun');
    add(`${word.slice(0, -3)}fe`, 'noun');
  }
  for (const ending of ['ches', 'shes', 'xes', 'zes']) {
    if (word.endsWith(ending)) add(word.slice(0, -2), 'noun');
  }
  if (word.endsWith('ses')) add(`${word.slice(0, -3)}s`, 'noun');
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1), 'noun');

  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`, 'verb');
  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`, 'verb');
  for (const ending of ['ing', 'ed']) {
    if (!word.endsWith(ending)) continue;
    const stem = word.slice(0, -ending.length);
    add(stem, 'verb');
    add(`${stem}e`, 'verb');
    if (stem.at(-1) === stem.at(-2)) add(stem.slice(0, -1), 'verb');
  }
  if (word.endsWith('es')) {
    add(word.slice(0, -2), 'verb');
    add(word.slice(0, -1), 'verb');
  }
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1), 'verb');

  for (const ending of ['ier', 'iest']) {
    if (word.endsWith(ending)) add(`${word.slice(0, -ending.length)}y`, 'adjective');
  }
  for (const ending of ['er', 'est']) {
    if (!word.endsWith(ending)) continue;
    const stem = word.slice(0, -ending.length);
    add(stem, 'adjective');
    add(`${stem}e`, 'adjective');
    if (stem.at(-1) === stem.at(-2)) add(stem.slice(0, -1), 'adjective');
  }
  return found;
}

function strongest(candidates) {
  return candidates.reduce((best, item) => (
    !best || STRENGTH[item.suit] > STRENGTH[best.suit] ? item : best
  ), null);
}

const directNonstandard = new Map(
  [...decisions].filter(([, entry]) => entry.suit !== 'standard'),
);
const inherited = new Map();
for (const [word, entry] of Object.entries(lexicon)) {
  if (decisions.has(word)) continue;
  const wordPos = broadPos(entry);
  const candidates = lemmaCandidates(word)
    .filter(({ lemma, kind }) => directNonstandard.has(lemma)
      && lexicon[lemma]
      && wordPos.has(kind)
      && (kind !== 'adjective' || wordPos.size === 1)
      && broadPos(lexicon[lemma]).has(kind))
    .map(({ lemma }) => ({ lemma, suit: directNonstandard.get(lemma).suit }));
  if (!candidates.length) continue;
  const suit = strongest(candidates).suit;
  inherited.set(word, {
    suit,
    lemmas: [...new Set(candidates.filter((item) => item.suit === suit).map((item) => item.lemma))]
      .sort((a, b) => a.localeCompare(b)),
  });
}

const counts = Object.fromEntries(SUITS.map((suit) => [suit, 0]));
const assignmentCounts = {
  'primary-sense': 0,
  'criteria-example': 0,
  inflection: 0,
  'default-standard': 0,
};
const auditWords = {};

for (const [word, entry] of Object.entries(lexicon)) {
  const direct = decisions.get(word);
  const inheritance = inherited.get(word);
  const suit = direct?.suit ?? inheritance?.suit ?? 'standard';
  entry.suit = suit;
  counts[suit] += 1;
  assignmentCounts[direct?.assignment ?? (inheritance ? 'inflection' : 'default-standard')] += 1;
  if (suit === 'standard') continue;
  auditWords[word] = direct ? {
    suit,
    assignment: direct.assignment,
    sources: direct.sources,
  } : {
    suit,
    assignment: 'inflection',
    inheritedFrom: inheritance.lemmas,
  };
}

const sortedLexicon = Object.fromEntries(
  Object.entries(lexicon).sort(([a], [b]) => a.localeCompare(b)),
);
const sortedAuditWords = Object.fromEntries(
  Object.entries(auditWords).sort(([a], [b]) => a.localeCompare(b)),
);
const report = {
  schema: 2,
  criteria: overrides.criteria,
  reviewedWords: Object.keys(sortedLexicon).length,
  primarySenseCandidates: primary.reviewedCandidates,
  resolution: 'representative first sense; vulgar > slang > formal > standard; ambiguity -> standard',
  counts,
  assignments: assignmentCounts,
  words: sortedAuditWords,
};

fs.writeFileSync(OUT, `${JSON.stringify(sortedLexicon)}\n`);
fs.writeFileSync(AUDIT, `${JSON.stringify(report)}\n`);
console.log(`reviewed ${report.reviewedWords} entries; ${report.primarySenseCandidates} first-sense candidates`);
console.log(counts);
console.log(assignmentCounts);
console.log(`wrote ${OUT} and ${AUDIT}`);
