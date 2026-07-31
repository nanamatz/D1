import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('New Run selector presentation', () => {
  it('uses stacked arrow-panel-arrow rows with a compact Record tier', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(component).toContain('className="run-choice-stage"');
    expect(component).toContain('className="carousel-dots"');
    expect(component).toContain('disabled={disabled || index === 0}');
    expect(component).toContain('disabled={disabled || index === ids.length - 1}');
    expect(css).toMatch(
      /\.run-choice\s*\{[^}]*grid-template-columns:\s*50px minmax\(0, 1fr\) 50px/s,
    );
    expect(css).toMatch(
      /\.run-choice-record \.select-preview\s*\{[^}]*min-height:\s*116px/s,
    );
    expect(css).toMatch(/\.run-start-row\s*\{[^}]*grid-template-columns:/s);
  });

  it('shows unlock copy only for locked Pouches', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const collection = source('src/ui/components/Collection.tsx');

    expect(component).toContain("const lockedPouch = kind === 'pouch' && !unlocked;");
    expect(component).toContain("const title = lockedPouch ? t('newrun.locked') : name;");
    expect(component).toContain('t(`pouch.${id}.unlock`)');
    expect(component).not.toContain('t(`record.${id}.unlock`)');
    expect(collection).toContain('const unlock = !unlocked');
    expect(collection).toContain(
      "{unlocked ? t(`pouch.${id}.name`) : t('newrun.locked')}",
    );
    expect(collection).toContain('{!unlocked && <small>🔒 {unlock}</small>}');
    expect(collection).not.toContain('t(`record.${id}.unlock`)');
  });

  it('keeps locked choices non-playable and removes Record unlock copy', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;

    expect(component).toContain('disabled={!pouchUnlocked}');
    expect(component).toContain('disabled={!canStart}');
    expect(Object.keys(en).some((key) => /^record\..+\.unlock$/.test(key))).toBe(false);
    expect(Object.keys(ko).some((key) => /^record\..+\.unlock$/.test(key))).toBe(false);
  });
});
