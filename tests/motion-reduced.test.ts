/**
 * Guard for the 2026-07-31 audit item VFX-01 / I-2.
 *
 * `reducedMotion` had been copy-pasted into twelve files with TWO different
 * bodies: seven read the OS media query AND the `force-reduced-motion` class
 * that `settings.ts` puts on <body> for the in-game Options toggle; five read
 * only the media query. The five that skipped the class were the settle
 * timeline, `useCountUp`, `MoneyValue`, the Sidebar tomato hop and `useGame`'s
 * blind-end pacing — so turning Reduced Motion ON stopped card drag and desk
 * objects while the whole scoreboard kept animating.
 *
 * Two assertions, because either one alone would have passed while broken:
 *   1. `motionOff()` really answers to both sources (behavioural)
 *   2. nothing outside `motion.ts` matches the media query again (structural)
 *
 * There is no jsdom in this project — every test runs in Node — so the globals
 * are stubbed here rather than pulling in a DOM environment for one predicate.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ui = join(process.cwd(), 'src', 'ui');

/** Install a minimal window/document pair; returns a handle to drive the two inputs. */
function stubDom(): { setOsSetting: (on: boolean) => void; setToggle: (on: boolean) => void } {
  let os = false;
  const classes = new Set<string>();
  (globalThis as Record<string, unknown>).window = {
    matchMedia: (query: string) => ({ matches: query.includes('reduce') && os }),
  };
  (globalThis as Record<string, unknown>).document = {
    body: { classList: { contains: (name: string) => classes.has(name) } },
  };
  return {
    setOsSetting: (on) => { os = on; },
    setToggle: (on) => { if (on) classes.add('force-reduced-motion'); else classes.delete('force-reduced-motion'); },
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
});

describe('motionOff', () => {
  it('is off by default, and ON for either source independently', async () => {
    const dom = stubDom();
    const { motionOff } = await import('../src/ui/motion');

    expect(motionOff()).toBe(false);

    // OS setting alone.
    dom.setOsSetting(true);
    expect(motionOff()).toBe(true);

    // In-game Options toggle alone — the case the five stale copies missed.
    dom.setOsSetting(false);
    dom.setToggle(true);
    expect(motionOff()).toBe(true);

    dom.setToggle(false);
    expect(motionOff()).toBe(false);
  });

  it('reads as motion-off when there is no DOM at all', async () => {
    const { motionOff } = await import('../src/ui/motion');
    expect(motionOff()).toBe(true); // nothing to animate → take the instant branch
  });

  it('is the only place in src/ui that queries the motion preference', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(full) || full.endsWith(`motion.ts`)) continue;
        const source = readFileSync(full, 'utf8');
        // Comments may mention it; only executable references count.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        if (/prefers-reduced-motion|force-reduced-motion/.test(code)) {
          // settings.ts legitimately WRITES the class; it must not read it.
          if (full.endsWith('settings.ts') && /classList\.toggle\('force-reduced-motion'/.test(code)) continue;
          offenders.push(full.slice(process.cwd().length + 1).replace(/\\/g, '/'));
        }
      }
    };
    walk(ui);
    expect(offenders).toEqual([]);
  });
});
