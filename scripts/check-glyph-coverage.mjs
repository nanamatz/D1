/**
 * Glyph-coverage guard for the font subsets `src/main.tsx` imports.
 *
 * The build used to import @fontsource's per-weight aggregates, which pull EVERY
 * subset the family publishes (Devanagari and Vietnamese for Baloo, Cyrillic for
 * Jost, Cyrillic/Vietnamese/latin-ext plus 120 CJK chunks for Noto Sans KR) —
 * 554 files and 9.26 MB for a game that renders English and Korean. Narrowing to
 * `latin-*` and `korean-*` cut that to 13 files / 1.20 MB.
 *
 * Narrowing subsets is exactly the change that silently loses glyphs: a missing
 * range does not fail the build, it renders tofu in the Korean locale. So this
 * asserts the inverse of what the fonts contain — that every character the app
 * can actually display stays inside the Unicode blocks our imported subsets are
 * defined to cover. Adding copy in a new script fails here rather than shipping.
 *
 * Run: node scripts/check-glyph-coverage.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The blocks our imported subsets cover, and which import supplies each.
 *
 * `latin` comes straight from @fontsource's published range (identical across
 * the four families). `korean` is not listed in `unicode.json` — that file
 * describes the 120-way CJK chunking of the per-weight aggregates, while
 * `korean-500.css` is the single-file build of the same subset — so the Hangul
 * blocks are named here explicitly. That is the contract this check enforces:
 * Korean copy must be Hangul, not Hanja or kana, which the Korean subset of a
 * Latin-plus-Hangul font is not guaranteed to carry.
 */
const BLOCKS = [
  { name: 'Latin (basic + Latin-1)', via: '@fontsource/*/latin-*.css', ranges: [[0x0000, 0x00ff]] },
  { name: 'Latin punctuation/symbols', via: '@fontsource/*/latin-*.css', ranges: [
    [0x0131, 0x0131], [0x0152, 0x0153], [0x02bb, 0x02bc], [0x02c6, 0x02c6],
    [0x02da, 0x02da], [0x02dc, 0x02dc], [0x0304, 0x0304], [0x0308, 0x0308],
    [0x0329, 0x0329], [0x2000, 0x206f], [0x2074, 0x2074], [0x20ac, 0x20ac],
    [0x2122, 0x2122], [0x2191, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215],
    [0xfeff, 0xfeff], [0xfffd, 0xfffd],
  ] },
  { name: 'Hangul syllables', via: '@fontsource/noto-sans-kr/korean-*.css', ranges: [[0xac00, 0xd7a3]] },
  { name: 'Hangul jamo (compatibility)', via: '@fontsource/noto-sans-kr/korean-*.css', ranges: [[0x3130, 0x318f]] },
  { name: 'Hangul jamo', via: '@fontsource/noto-sans-kr/korean-*.css', ranges: [[0x1100, 0x11ff]] },
  { name: 'CJK punctuation', via: '@fontsource/noto-sans-kr/korean-*.css', ranges: [[0x3000, 0x303f]] },
  // Geometric/technical glyphs the UI draws itself (including the
  // letterless-Stone sentinel). These are NOT in any imported subset and
  // fall back to the OS symbol font by design — `tokens.css` sets an explicit
  // symbol stack for them. Listed so the check stays honest about it.
  { name: 'UI symbol glyphs (OS fallback by design)', via: 'Arial Unicode MS / Segoe UI Symbol stack', ranges: [
    [0x2190, 0x21ff], [0x2200, 0x22ff], [0x2300, 0x23ff], [0x25a0, 0x25ff],
    [0x2600, 0x27bf], [0x2b00, 0x2bff], [0x1f300, 0x1faff], [0xfe0f, 0xfe0f],
    [0x2028, 0x2029], [0x200d, 0x200d],
  ] },
];

const blockFor = (code) =>
  BLOCKS.find((block) => block.ranges.some(([lo, hi]) => code >= lo && code <= hi));

/** Every character the UI can render. */
function displayedCharacters() {
  const chars = new Map(); // char -> where it came from
  const add = (text, where) => {
    for (const ch of String(text)) if (!chars.has(ch)) chars.set(ch, where);
  };
  for (const locale of ['en', 'ko']) {
    const table = JSON.parse(readFileSync(join(root, 'locales', `${locale}.json`), 'utf8'));
    for (const [key, value] of Object.entries(table)) add(value, `${locale}.json:${key}`);
  }
  // Glyphs drawn from code rather than copy: tile letters and the letterless-Stone
  // sentinel (scoring.ts NO_LETTER).
  add('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'tile letters');
  add('□', 'scoring.ts NO_LETTER');
  return chars;
}

const uncovered = [];
const used = new Map(); // block name -> count
for (const [ch, where] of displayedCharacters()) {
  const code = ch.codePointAt(0);
  if (code < 0x20 || code === 0x7f) continue; // control chars are never glyphs
  const block = blockFor(code);
  if (!block) {
    uncovered.push({ ch, code, where });
    continue;
  }
  used.set(block.name, (used.get(block.name) ?? 0) + 1);
}

console.log('Characters in use, by block:');
for (const block of BLOCKS) {
  const count = used.get(block.name) ?? 0;
  if (count > 0) console.log(`  ${String(count).padStart(5)}  ${block.name}  <- ${block.via}`);
}

if (uncovered.length > 0) {
  console.error(`\nFAIL: ${uncovered.length} character(s) fall outside every imported subset:\n`);
  for (const { ch, code, where } of uncovered.slice(0, 40)) {
    console.error(`  U+${code.toString(16).toUpperCase().padStart(4, '0')}  ${JSON.stringify(ch)}  (${where})`);
  }
  console.error('\nEither import the subset that covers them in src/main.tsx (and add the');
  console.error('block above), or change the copy. Do not ship a character with no font.\n');
  process.exit(1);
}

console.log('\nOK: every displayed character is inside an imported subset.');
