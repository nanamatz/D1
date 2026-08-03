#!/usr/bin/env node
/**
 * Fetch register-labelled English terms from Wiktionary categories.
 * This is an offline build step; the game never performs network requests.
 *
 * Usage:
 *   node lexicon-pipeline/fetch-wiktionary-registers.mjs \
 *     --out lexicon-pipeline/wiktionary-registers.json
 */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);

const OUT = args.out ?? 'lexicon-pipeline/wiktionary-registers.json';
const CACHE = args.cache ?? '.cache/wiktionary-register-categories.json';
const MAX_DEPTH = Number.parseInt(args.depth ?? '1', 10);
const API = 'https://en.wiktionary.org/w/api.php';
const USER_AGENT = 'Play-the-World lexicon audit/1.0 (offline data build)';

const ROOTS = {
  formal: [
    'English formal terms',
    'English higher register terms',
    'English literary terms',
    'English poetic terms',
    'English officialese terms',
    'English technical terms',
    'English archaic terms',
    'en:Law',
  ],
  slang: ['English slang'],
  vulgar: [
    'English vulgarities',
    'English offensive terms',
    'English anti-LGBTQ slurs',
    'English ethnic slurs',
    'English religious slurs',
  ],
};

const ROOT_DEPTHS = {
  'en:Law': 0,
};

const categoryCache = new Map();
const diskCache = fs.existsSync(CACHE)
  ? JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  : {};
let lastRequestAt = 0;

function saveCache() {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(diskCache));
}

async function request(params, attempt = 1) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    maxlag: '5',
    ...params,
  });
  try {
    const delay = Math.max(0, 300 - (Date.now() - lastRequestAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestAt = Date.now();
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (!response.ok) {
      const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '0', 10);
      const error = new Error(`HTTP ${response.status}`);
      error.retryAfter = retryAfter;
      throw error;
    }
    const body = await response.json();
    if (body.error) throw new Error(body.error.info ?? body.error.code);
    return body;
  } catch (error) {
    if (attempt >= 5) throw error;
    const retryMs = Math.max((error.retryAfter ?? 0) * 1000, 1000 * (2 ** attempt));
    await new Promise((resolve) => setTimeout(resolve, retryMs));
    return request(params, attempt + 1);
  }
}

function fetchCategory(name) {
  if (categoryCache.has(name)) return categoryCache.get(name);
  const pending = (async () => {
    const cached = diskCache[name] ?? { pages: [], subcategories: [], continuation: null, complete: false };
    if (cached.complete) return cached;
    const pages = cached.pages;
    const subcategories = cached.subcategories;
    let continuation = cached.continuation;
    do {
      const body = await request({
        list: 'categorymembers',
        cmtitle: `Category:${name}`,
        cmnamespace: '0|14',
        cmtype: 'page|subcat',
        cmlimit: 'max',
        ...(continuation ? { cmcontinue: continuation } : {}),
      });
      for (const member of body.query?.categorymembers ?? []) {
        if (member.ns === 0) pages.push(member.title);
        if (member.ns === 14) subcategories.push(member.title.replace(/^Category:/, ''));
      }
      continuation = body.continue?.cmcontinue;
      diskCache[name] = {
        pages,
        subcategories,
        continuation: continuation ?? null,
        complete: !continuation,
      };
      saveCache();
    } while (continuation);
    return { pages, subcategories };
  })();
  categoryCache.set(name, pending);
  return pending;
}

async function collectRoot(root) {
  const maxDepth = ROOT_DEPTHS[root] ?? MAX_DEPTH;
  const terms = new Set();
  const categories = [];
  const seen = new Set();
  let frontier = [{ name: root, depth: 0 }];
  while (frontier.length > 0) {
    const batch = frontier.filter(({ name }) => !seen.has(name));
    frontier = [];
    for (const { name } of batch) seen.add(name);
    const results = [];
    for (const { name, depth } of batch) {
      results.push({ name, depth, data: await fetchCategory(name) });
    }
    for (const { name, depth, data } of results) {
      categories.push(name);
      for (const title of data.pages) {
        const word = title.toLowerCase();
        if (/^[a-z]+$/.test(word)) terms.add(word);
      }
      if (depth < maxDepth) {
        frontier.push(...data.subcategories.map((name) => ({ name, depth: depth + 1 })));
      }
    }
  }
  console.log(`${root}: ${terms.size} alphabetic terms from ${categories.length} categories`);
  return { terms, categories };
}

const snapshot = {
  schema: 1,
  source: 'English Wiktionary categorymembers API',
  sourceUrl: 'https://en.wiktionary.org/wiki/Category:English_terms_by_usage',
  license: 'CC BY-SA 4.0 and GFDL; see data/WIKTIONARY_ATTRIBUTION.md',
  retrieved: new Date().toISOString().slice(0, 10),
  maxDepth: MAX_DEPTH,
  roots: ROOTS,
  categories: {},
  rootTerms: {},
  terms: {},
};

for (const [suit, roots] of Object.entries(ROOTS)) {
  const results = [];
  for (const root of roots) results.push(await collectRoot(root));
  snapshot.rootTerms[suit] = Object.fromEntries(results.map(({ terms }, index) => [
    roots[index],
    [...terms].sort((a, b) => a.localeCompare(b)),
  ]));
  snapshot.categories[suit] = [...new Set(results.flatMap(({ categories }) => categories))]
    .sort((a, b) => a.localeCompare(b));
  snapshot.terms[suit] = [...new Set(results.flatMap(({ terms }) => [...terms]))]
    .sort((a, b) => a.localeCompare(b));
  console.log(`${suit}: ${snapshot.terms[suit].length} unique alphabetic terms`);
}

fs.writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`wrote ${OUT}`);
