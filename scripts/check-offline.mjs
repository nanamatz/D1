/**
 * Offline build gate.
 *
 * The desktop build loads dist/ over file:// with no network. Two kinds of
 * change break that while working perfectly in a browser, so they are invisible
 * during development:
 *   1. an external http(s) dependency (a CDN font, script or image)
 *   2. an asset path starting with "/" (only resolves when served from a root)
 *
 * Scans the whole build output — a CDN URL can hide inside a stylesheet or a
 * bundled component, not just index.html.
 *
 * Usage: node scripts/check-offline.mjs [distDir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * URLs that appear in the bundle but are never fetched. Keep this list narrow —
 * every entry is a hole in the gate.
 *   - w3.org: XML namespace identifiers, from bundled SVGs.
 *   - reactjs.org / react.dev: React's production error-decoder link. It is
 *     printed into an error message for a human to open, never requested.
 */
const URL_ALLOWLIST = [
  /^https?:\/\/www\.w3\.org\//,
  /^https?:\/\/reactjs\.org\//,
  /^https?:\/\/react\.dev\//,
];

const URL_RE = /https?:\/\/[^\s"'`)\\]+/g;
/** Absolute src/href in markup. */
const ABS_ATTR_RE = /(?:src|href)\s*=\s*"\/[^"]*"/g;
/** Absolute url() in CSS. */
const ABS_URL_RE = /url\(\s*['"]?\/[^)'"]*/g;

const MARKUP_EXT = new Set(['.html', '.css']);

/**
 * @param {string} fileName path used for reporting; its extension selects rules
 * @param {string} content
 * @returns {{file: string, kind: 'external-url'|'absolute-path', snippet: string}[]}
 */
export function findViolations(fileName, content) {
  const out = [];

  for (const match of content.matchAll(URL_RE)) {
    const url = match[0];
    if (URL_ALLOWLIST.some((re) => re.test(url))) continue;
    out.push({ file: fileName, kind: 'external-url', snippet: url });
  }

  // Absolute-path rules apply to markup only. JS bundles legitimately contain
  // strings beginning with "/" that are not asset references.
  if (MARKUP_EXT.has(path.extname(fileName))) {
    for (const re of [ABS_ATTR_RE, ABS_URL_RE]) {
      for (const match of content.matchAll(re)) {
        out.push({ file: fileName, kind: 'absolute-path', snippet: match[0] });
      }
    }
  }

  return out;
}

/** @returns {string[]} every file under dir, recursively, as paths relative to dir */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

const SCANNED_EXT = new Set(['.html', '.css', '.js']);

function main() {
  const distDir = process.argv[2] ?? 'dist';
  const files = walk(distDir).filter((f) => SCANNED_EXT.has(path.extname(f)));
  const violations = files.flatMap((f) =>
    findViolations(f, readFileSync(path.join(distDir, f), 'utf8')),
  );

  if (violations.length > 0) {
    console.error(`\nOffline gate FAILED — ${violations.length} violation(s):\n`);
    for (const v of violations) console.error(`  [${v.kind}] ${v.file}\n      ${v.snippet}`);
    console.error(
      '\nThe desktop build has no network and loads over file://.' +
        '\nBundle the dependency at build time instead of fetching it.\n',
    );
    process.exit(1);
  }
  console.log(`Offline gate passed (${files.length} files scanned).`);
}

// Only run the CLI when invoked directly, so tests can import findViolations.
// pathToFileURL is the reliable comparison on Windows: a raw import.meta.url
// pathname carries a leading slash (/C:/...) and will not match a plain path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
