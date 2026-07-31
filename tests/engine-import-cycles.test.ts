/**
 * Guard for the 2026-07-31 P0: two runtime import cycles in `src/engine` made
 * `jokers/index`, `loop`, `shop` and `packs` throw
 * `ReferenceError: Cannot access 'RARE_JOKERS' before initialization` whenever
 * one of them was the FIRST engine module a process loaded.
 *
 *   economy -> pouches -> gamblers -> jokers/index -> interestGlutton -> economy
 *   fables  -> economy -> pouches  -> gamblers -> fables
 *
 * The whole suite stayed green through it: vitest happened to load the graph in
 * a surviving order, so "778 tests pass" never touched the broken entry points.
 * That is precisely why this is a static graph assertion rather than an import —
 * importing the modules here would inherit the same lucky ordering and prove
 * nothing.
 *
 * `scripts/check-engine-cycles.mjs` additionally imports every engine entry in a
 * FRESH process (the only way to catch a cycle that is currently survivable);
 * `npm run build` runs it. This test is the fast half that runs on every change.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs tooling script, no type declarations by design
import { findEngineCycles } from '../scripts/check-engine-cycles.mjs';

describe('engine module graph', () => {
  it('has no runtime import cycles', () => {
    const { cycles, moduleCount } = findEngineCycles() as {
      cycles: string[][];
      moduleCount: number;
    };
    // Guard the guard: a broken walker would report zero cycles vacuously.
    expect(moduleCount).toBeGreaterThan(100);
    expect(cycles.map((cycle) => cycle.join(' -> '))).toEqual([]);
  });

  it('keeps the Gambler id space in a leaf module', () => {
    // The fix that closed both cycles. If `pouches` reaches back into
    // `gamblers` (or `gamblerIds` grows a runtime import), they come back.
    const pouches = readFile('src/engine/pouches.ts');
    expect(pouches).toContain("from './gamblerIds'");
    expect(pouches).not.toMatch(/from '\.\/gamblers'/);

    const ids = readFile('src/engine/gamblerIds.ts');
    const runtimeImports = [...ids.matchAll(/^\s*import\s+(?!type\s)[\s\S]*?from/gm)];
    expect(runtimeImports).toHaveLength(0);
  });
});

function readFile(path: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:fs').readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
