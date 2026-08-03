#!/usr/bin/env node
/**
 * Resolve the first English dictionary sense for every register candidate.
 * Category membership finds candidates; the first definition's usage label
 * decides the representative register required by the project criteria.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);

const SNAPSHOT = args.snapshot ?? 'lexicon-pipeline/wiktionary-registers.json';
const LEXICON = args.lexicon ?? 'data/lexicon.json';
const OUT = args.out ?? 'lexicon-pipeline/wiktionary-primary-registers.json';
const CACHE = args.cache ?? '.cache/wiktionary-primary-registers.json';
const BATCH_SIZE = Number.parseInt(args.batch ?? '50', 10);
const WORKERS = Number.parseInt(args.workers ?? '2', 10);
const API = 'https://en.wiktionary.org/w/api.php';
const USER_AGENT = 'Play-the-World lexicon audit/2.0 (offline data build)';
const MAX_WORD_LENGTH = 18;

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const lexicon = JSON.parse(fs.readFileSync(LEXICON, 'utf8'));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const candidates = [...new Set(
  Object.values(snapshot.terms).flat().filter((word) => (
    word.length <= MAX_WORD_LENGTH && Object.hasOwn(lexicon, word)
  )),
)].sort((a, b) => a.localeCompare(b));

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
}

async function request(words, attempt = 1) {
  const body = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'revisions',
    rvprop: 'ids|content',
    rvslots: 'main',
    redirects: '1',
    titles: words.join('|'),
  });
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': USER_AGENT,
      },
      body,
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '0', 10);
      throw error;
    }
    const data = await response.json();
    if (data.error) throw new Error(data.error.info ?? data.error.code);
    return data;
  } catch (error) {
    if (attempt >= 6) throw error;
    const retryMs = Math.max((error.retryAfter ?? 0) * 1000, 1500 * (2 ** attempt));
    await new Promise((resolve) => setTimeout(resolve, retryMs));
    return request(words, attempt + 1);
  }
}

function englishSection(text) {
  const start = text.search(/^==English==\s*$/m);
  if (start < 0) return '';
  const rest = text.slice(start).replace(/^==English==\s*\r?\n?/m, '');
  const end = rest.search(/^==[^=].*==\s*$/m);
  return end < 0 ? rest : rest.slice(0, end);
}

function usageLabels(text) {
  const labels = [];
  const regex = /\{\{(?:lb|label|tlb)\|en\|([^{}]*)\}\}/gi;
  for (const match of text.matchAll(regex)) {
    for (const value of match[1].split('|')) {
      const label = value.trim().toLowerCase();
      if (label && !label.includes('=') && !['_', 'and', 'or'].includes(label)) labels.push(label);
    }
  }
  if (/\{\{archaic (?:form|spelling) of\|en\|/i.test(text)) labels.push('archaic');
  return [...new Set(labels)];
}

function registerFor(labels) {
  const joined = labels.join(' ');
  if (/\b(vulgar|taboo|obscene|offensive|slur|swear)\b/.test(joined)) return 'vulgar';
  if (/\bslang\b|\baave\b/.test(joined)) return 'slang';
  if (/\b(formal|literary|archaic|technical|legal|law|poetic|officialese|bureaucratic)\b/.test(joined)) {
    return 'formal';
  }
  return 'standard';
}

function parsePage(page) {
  const revision = page.revisions?.[0];
  const section = englishSection(revision?.slots?.main?.content ?? '');
  const definition = /^#(?![#*:])\s*(.*)$/m.exec(section);
  if (!definition) return { register: 'standard', labels: [], revision: revision?.revid ?? null };
  const before = section.slice(0, definition.index);
  const headings = [...before.matchAll(/^={3,}[^=].*={3,}\s*$/gm)];
  const blockStart = headings.at(-1)?.index ?? 0;
  const labels = usageLabels(`${before.slice(blockStart)}\n${definition[1]}`);
  return { register: registerFor(labels), labels, revision: revision?.revid ?? null };
}

if (process.argv.includes('--self-test')) {
  const page = (content) => ({ revisions: [{ revid: 1, slots: { main: { content } } }] });
  const cases = [
    ['==English==\n===Adjective===\n# Ill.\n# {{lb|en|slang}} Excellent.', 'standard'],
    ['==English==\n===Noun===\n# {{lb|en|slang}} Charm.', 'slang'],
    ['==English==\n===Verb===\n# {{lb|en|offensive}} To copulate.', 'vulgar'],
    ['==English==\n===Noun===\n{{tlb|en|formal}}\n# An elevated term.', 'formal'],
  ];
  for (const [content, expected] of cases) {
    const actual = parsePage(page(content)).register;
    if (actual !== expected) throw new Error(`self-test: expected ${expected}, got ${actual}`);
  }
  console.log('primary-register parser self-test passed');
  process.exit(0);
}

function resolvedTitles(data, words) {
  const aliases = new Map(words.map((word) => [word, word]));
  for (const row of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
    for (const [word, target] of aliases) {
      if (target.toLowerCase() === row.from.toLowerCase()) aliases.set(word, row.to);
    }
  }
  const pages = new Map((data.query?.pages ?? []).map((page) => [page.title.toLowerCase(), page]));
  return new Map([...aliases].map(([word, target]) => [word, pages.get(target.toLowerCase())]));
}

const batches = [];
for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
  const pending = candidates.slice(index, index + BATCH_SIZE).filter((word) => !cache[word]);
  if (pending.length) batches.push(pending);
}

let cursor = 0;
let completed = candidates.length - batches.reduce((sum, batch) => sum + batch.length, 0);
async function worker() {
  while (cursor < batches.length) {
    const batch = batches[cursor];
    cursor += 1;
    const data = await request(batch);
    for (const [word, page] of resolvedTitles(data, batch)) {
      cache[word] = page ? parsePage(page) : { register: 'standard', labels: [], revision: null };
    }
    completed += batch.length;
    saveCache();
    console.log(`${completed}/${candidates.length}`);
  }
}

await Promise.all(Array.from({ length: Math.min(WORKERS, batches.length || 1) }, worker));

const words = Object.fromEntries(candidates.map((word) => [word, cache[word]]));
const counts = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
for (const entry of Object.values(words)) counts[entry.register] += 1;
const output = {
  schema: 1,
  source: 'English Wiktionary first English definition and usage label',
  sourceSnapshotRetrieved: snapshot.retrieved,
  criteria: 'docs/# 영단어 레지스터 분류 기준.md',
  reviewedCandidates: candidates.length,
  counts,
  words,
};
fs.writeFileSync(OUT, `${JSON.stringify(output)}\n`);
console.log(counts);
console.log(`wrote ${OUT}`);
