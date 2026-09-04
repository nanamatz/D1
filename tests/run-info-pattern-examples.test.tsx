import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PatternId } from '../src/engine/types';
import { PATTERN_EXAMPLES } from '../src/ui/components/PatternExample';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const EXPECTED: Record<PatternId, string> = {
  outcry: 'SHH',
  simple: 'BIRDS FLY',
  imperative: 'EAT FISH',
  transitive: 'CAT EATS FISH',
  negative: 'SHE ISNT HERE',
  interrogative: 'ARE YOU READY',
  descriptive: 'PIZZA SEEMS TASTY',
  chant: 'EAT EAT',
  objectComplement: 'I MADE HIM HAPPY',
  ditransitive: 'I GIVE HIM FISH',
  compound: 'CATS RUN AND DOGS SLEEP',
  complex: 'BECAUSE IT RAINED I STAYED HOME',
};

const examples: Readonly<Record<PatternId, {
  tokens: readonly { word: string; pos?: string }[];
}>> = PATTERN_EXAMPLES;

const source = (path: string) => readFileSync(path, 'utf8');

describe('Run Info sentence-pattern examples', () => {
  it('covers every PatternId with the official GDD example in reading order', () => {
    expect(Object.keys(examples)).toEqual(Object.keys(EXPECTED));
    for (const [id, expected] of Object.entries(EXPECTED) as [PatternId, string][]) {
      const words = examples[id].tokens.map(({ word }) => word)
        .join(' ');
      expect(words).toBe(expected);
    }
  });

  it('assigns each ordinary word a real POS colour and keeps the special marker neutral', () => {
    for (const example of Object.values(examples)) {
      for (const token of example.tokens) {
        if (token.pos) {
          expect(en).toHaveProperty(`pos.${token.pos}`);
          expect(ko).toHaveProperty(`pos.${token.pos}`);
        }
      }
    }
    expect(en).toHaveProperty('runinfo.patternExampleA11y');
    expect(ko).toHaveProperty('runinfo.patternExampleA11y');
  });

  it('keeps ISNT neutral rather than inventing a selected POS', () => {
    const patternExample = source('src/ui/components/PatternExample.tsx');
    const css = source('src/ui/styles/screens.css');
    const isnt = examples.negative.tokens.find(({ word }) => word === 'ISNT');
    expect(isnt).toEqual({ word: 'ISNT' });
    expect(patternExample).toContain("token.pos ? `pos-${token.pos}` : 'grammar-marker'");
    expect(css).toContain('.pattern-example-token.grammar-marker { --pos-tone: var(--ink-dim); }');
  });

  it('renders only coloured word boxes without an Example heading, divider, or labels', () => {
    const patternExample = source('src/ui/components/PatternExample.tsx');
    const css = source('src/ui/styles/screens.css');
    const tray = patternExample.slice(patternExample.indexOf('function PatternExampleTray'));
    expect(tray).not.toContain('pattern-example-title');
    expect(tray).not.toContain('pattern-example-clause');
    expect(tray).not.toContain('<small>');
    expect(tray).not.toContain('patternrole.');
    expect(tray).not.toContain('pattern-example-arrow');
    expect(tray).not.toContain('pattern-example-row');
    expect(css).not.toMatch(/\.pattern-example\s*\{[^}]*border-top/s);
    expect(css).not.toContain('.pattern-example-arrow');
    expect(css).not.toContain('.pattern-example-row-arrow');
    expect(css).toMatch(/\.pattern-example-visual\s*\{[^}]*flex-wrap:\s*nowrap/s);
    expect(css).toMatch(/\.pattern-example-visual\s*\{[^}]*width:\s*100%[^}]*justify-content:\s*space-evenly/s);
    expect(css).toMatch(/\.pattern-example-token\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--pos-tone\) 72%, #fff\)/s);
  });

  it('constructs rich content only after the existing hidden-pattern filter', () => {
    const runInfo = source('src/ui/components/RunInfo.tsx');
    const filter = runInfo.indexOf('.filter((p) => !isHiddenPattern(p)');
    const example = runInfo.indexOf('content={<PatternExampleTray pattern={p} />}');
    expect(filter).toBeGreaterThan(-1);
    expect(example).toBeGreaterThan(filter);
    const patternExample = source('src/ui/components/PatternExample.tsx');
    expect(patternExample).toContain('<span className="pattern-example">');
    expect(patternExample).toContain('className="pattern-example-visual"');
    expect(patternExample).toContain('role="group"');
    expect(patternExample).toContain('aria-label={t(\'runinfo.patternExampleA11y\'');
    expect(patternExample).toContain('tabIndex={0}');
    expect(patternExample).toContain('key={`${token.word}-${tokenIndex}`}\n            aria-hidden');
  });

  it('keeps each pattern row keyboard/touch reachable without token tab stops', () => {
    const runInfo = source('src/ui/components/RunInfo.tsx');
    const css = source('src/ui/styles/screens.css');
    expect(runInfo).toContain('touchPin');
    expect(runInfo).toContain('viewportContain');
    expect(runInfo).toContain('tabIndex={0}');
    expect(runInfo).not.toMatch(/pattern-example-token[^>]*tabIndex/);
    expect(css).toMatch(/\.pattern-example-visual:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--gold\)/s);
  });

  it('uses a pattern-only rich slot and viewport containment without changing ordinary tooltips', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    const css = source('src/ui/styles/screens.css');
    expect(tooltip).toContain('content?: ReactNode');
    expect(tooltip).toContain('viewportContain?: boolean');
    expect(tooltip).toContain("viewportContain ? 'viewport-contained' : ''");
    expect(tooltip).toContain("card.style.setProperty('--tt-contained-y'");
    expect(css).toMatch(/\.tt-card\.tt-portal\.viewport-contained\s*\{[^}]*max-height:\s*calc\(100vh - 16px\)/s);
    expect(css).toContain('@media (forced-colors: active)');
  });
});
