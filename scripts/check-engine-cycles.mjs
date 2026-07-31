/**
 * Engine module-graph guard.
 *
 * A circular import between engine modules is not a style problem here: a cycle
 * that crosses a module-level `const` read throws `ReferenceError: Cannot access
 * X before initialization` (TDZ) for whichever entry point happens to be imported
 * first. The test suite and `npm run sim` load the graph in an order that happens
 * to work; `sim:emoji-sample` and a bare `import './engine/jokers'` did not.
 *
 * So this checks two things, and both matter:
 *   1. no import cycle among `src/engine/**`
 *   2. every engine entry point actually imports on its own, in a fresh process
 *
 * (2) is the one that catches a cycle that is technically present but currently
 * survivable — it fails the moment the survivable ordering stops being lucky.
 *
 * Run: node scripts/check-engine-cycles.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = join(root, 'src', 'engine');

/** Every .ts file under src/engine, as repo-relative paths. */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/** Resolve a relative specifier to a file in the graph (dir/index.ts or file.ts). */
function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

/**
 * Import edges, TYPE-ONLY IMPORTS EXCLUDED. `import type` is erased before the
 * module ever runs, so it cannot participate in a runtime TDZ cycle — counting it
 * would report cycles that can never throw.
 */
const IMPORT = /^\s*import\s+(?!type\s)(?:[\s\S]*?)\s*from\s*['"](\.[^'"]*)['"]/gm;

const rel = (f) => relative(root, f).replace(/\\/g, '/');

/**
 * Every runtime import cycle in `src/engine`, as arrays of repo-relative paths.
 * Pure fs + regex (no module execution), so `tests/engine-import-cycles.test.ts`
 * can call it directly and keep the guard inside `npm test`.
 */
export function findEngineCycles() {
  const files = walk(engine);
  const graph = new Map();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const edges = [];
    for (const match of source.matchAll(IMPORT)) {
      const target = resolveSpecifier(file, match[1]);
      if (target) edges.push(target);
    }
    graph.set(file, edges);
  }

  // Depth-first search; the first cycle found per start node is enough to act on.
  const found = [];
  const state = new Map(); // file -> 'visiting' | 'done'
  const stack = [];
  const visit = (file) => {
    if (state.get(file) === 'done') return;
    if (state.get(file) === 'visiting') {
      found.push([...stack.slice(stack.indexOf(file)), file].map(rel));
      return;
    }
    state.set(file, 'visiting');
    stack.push(file);
    for (const next of graph.get(file) ?? []) visit(next);
    stack.pop();
    state.set(file, 'done');
  };
  for (const file of files) visit(file);
  return { cycles: found, moduleCount: files.length };
}

function main() {
const { cycles, moduleCount } = findEngineCycles();

let failed = false;
if (cycles.length > 0) {
  failed = true;
  console.error(`\nFAIL: ${cycles.length} import cycle(s) in src/engine:\n`);
  for (const cycle of cycles) console.error(`  ${cycle.join('\n    -> ')}\n`);
} else {
  console.log(`OK: no import cycles across ${moduleCount} engine modules.`);
}

/**
 * Fresh-process import of each entry. Anything a UI/sim/test file imports from
 * `src/engine` must survive being the FIRST module loaded — that is exactly the
 * condition the lucky orderings were hiding.
 */
const ENTRIES = [
  'src/engine/jokers/index.ts',
  'src/engine/gamblers.ts',
  'src/engine/fables.ts',
  'src/engine/pouches.ts',
  'src/engine/economy.ts',
  'src/engine/loop.ts',
  'src/engine/shop.ts',
  'src/engine/packs.ts',
  'src/engine/bosses.ts',
  'src/engine/vouchers.ts',
  'src/engine/consumables.ts',
  'src/engine/progression.ts',
];

for (const entry of ENTRIES) {
  try {
    execFileSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', `import ${JSON.stringify('./' + entry)};`],
      { cwd: root, stdio: 'pipe' },
    );
    console.log(`OK: ${entry} imports standalone.`);
  } catch (error) {
    failed = true;
    const detail = String(error.stderr ?? error.message).split('\n').find((l) => /Error/.test(l));
    console.error(`FAIL: ${entry} cannot be imported on its own — ${detail ?? 'unknown'}`);
  }
}

process.exit(failed ? 1 : 0);
}

// CLI when run directly; a pure module when the test imports `findEngineCycles`.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
