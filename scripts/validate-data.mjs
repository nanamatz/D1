import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const table = JSON.parse(readFileSync(resolve(root, 'data/lexicon.json'), 'utf8'));
const registerAudit = JSON.parse(readFileSync(resolve(root, 'data/register-audit.json'), 'utf8'));
const primaryRegisters = JSON.parse(readFileSync(
  resolve(root, 'lexicon-pipeline/wiktionary-primary-registers.json'),
  'utf8',
));
const registerOverrides = JSON.parse(readFileSync(
  resolve(root, 'lexicon-pipeline/register-overrides.json'),
  'utf8',
));
const posOverrides = JSON.parse(readFileSync(
  resolve(root, 'lexicon-pipeline/pos-overrides.json'),
  'utf8',
));
const dictionary = readFileSync(resolve(root, 'data/dictionary.txt'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
const maxWordLength = 18;
const dictionaryTarget = 172228; // eligible ENABLE words + 13 tile-grammar exceptions
const lexiconTarget = 172251; // dictionary + 23 retained pre-existing entries
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
if (Object.keys(table).length !== lexiconTarget) {
  errors.push(`lexicon: expected ${lexiconTarget} entries, found ${Object.keys(table).length}`);
}
if (new Set(dictionary).size !== dictionary.length) {
  errors.push('dictionary: duplicate words');
}
if (dictionary.some((word) => !/^[a-z]+$/.test(word))) {
  errors.push('dictionary: invalid word');
}
if (dictionary.some((word) => word.length > maxWordLength)) {
  errors.push(`dictionary: word exceeds ${maxWordLength} letters`);
}
if (dictionary.some((word, index) => index > 0 && dictionary[index - 1].localeCompare(word) > 0)) {
  errors.push('dictionary: words are not sorted');
}
for (const word of dictionary) {
  if (!Object.hasOwn(table, word)) errors.push(`${word}: dictionary word has no lexicon entry`);
}
for (const [word, entry] of Object.entries(table)) {
  if (!/^[a-z]+$/.test(word)) errors.push(`${word}: invalid key`);
  if (word.length > maxWordLength) errors.push(`${word}: exceeds ${maxWordLength} letters`);
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
for (const [word, pos] of Object.entries(posOverrides)) {
  if (!table[word]) errors.push(`${word}: POS override word missing from lexicon`);
  else if (!Array.isArray(pos) || pos.length === 0 || pos.some((value) => !parts.has(value))) {
    errors.push(`${word}: invalid POS override`);
  } else if (JSON.stringify(table[word].pos) !== JSON.stringify(pos)) {
    errors.push(`${word}: POS override ${pos.join(',')} != lexicon ${table[word].pos.join(',')}`);
  }
}

const suitCounts = Object.fromEntries([...suits].map((suit) => [suit, 0]));
for (const entry of Object.values(table)) suitCounts[entry.suit] += 1;
if (registerAudit.schema !== 2) {
  errors.push(`register audit: expected schema 2, found ${registerAudit.schema}`);
}
if (registerAudit.reviewedWords !== Object.keys(table).length) {
  errors.push(`register audit: reviewed ${registerAudit.reviewedWords}, lexicon has ${Object.keys(table).length}`);
}
const primaryWords = primaryRegisters.words ?? {};
if (primaryRegisters.reviewedCandidates !== Object.keys(primaryWords).length) {
  errors.push('primary register snapshot: reviewed candidate count is stale');
}
if (registerAudit.primarySenseCandidates !== primaryRegisters.reviewedCandidates) {
  errors.push('register audit: primary-sense candidate count is stale');
}
for (const suit of suits) {
  if (registerAudit.counts?.[suit] !== suitCounts[suit]) {
    errors.push(`register audit: ${suit} count ${registerAudit.counts?.[suit]} != ${suitCounts[suit]}`);
  }
}
const assignmentTotal = Object.values(registerAudit.assignments ?? {})
  .reduce((sum, count) => sum + count, 0);
if (assignmentTotal !== Object.keys(table).length) {
  errors.push(`register audit: ${assignmentTotal} assignments for ${Object.keys(table).length} entries`);
}

const overrideMap = new Map();
for (const suit of suits) {
  for (const word of registerOverrides[suit] ?? []) overrideMap.set(word, suit);
}
for (const [word, primaryEntry] of Object.entries(primaryWords)) {
  if (!table[word]) {
    errors.push(`${word}: primary register candidate missing from lexicon`);
    continue;
  }
  if (!suits.has(primaryEntry.register)) {
    errors.push(`${word}: invalid primary register ${primaryEntry.register}`);
    continue;
  }
  const expected = overrideMap.get(word) ?? primaryEntry.register;
  if (table[word].suit !== expected) {
    errors.push(`${word}: primary register ${expected} != lexicon ${table[word].suit}`);
  }
}
for (const [word, expected] of overrideMap) {
  if (table[word] && table[word].suit !== expected) {
    errors.push(`${word}: criteria example ${expected} != lexicon ${table[word].suit}`);
  }
}
const auditedWords = registerAudit.words ?? {};
for (const [word, entry] of Object.entries(table)) {
  if (entry.suit !== 'standard' && auditedWords[word]?.suit !== entry.suit) {
    errors.push(`${word}: non-standard suit missing or stale in register audit`);
  }
}
for (const [word, auditEntry] of Object.entries(auditedWords)) {
  if (!table[word]) errors.push(`${word}: register audit word missing from lexicon`);
  else if (table[word].suit !== auditEntry.suit) {
    errors.push(`${word}: register audit suit ${auditEntry.suit} != lexicon ${table[word].suit}`);
  }
  if (!['primary-sense', 'criteria-example', 'inflection'].includes(auditEntry.assignment)) {
    errors.push(`${word}: invalid register audit assignment ${auditEntry.assignment}`);
  }
}

if (errors.length > 0) {
  console.error(errors.slice(0, 20).join('\n'));
  console.error(`FAIL: ${errors.length} lexicon data error(s).`);
  process.exit(1);
}

console.log(`OK: ${dictionary.length} dictionary words and ${Object.keys(table).length} lexicon entries validated.`);
