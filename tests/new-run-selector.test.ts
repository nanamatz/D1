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
    expect(collection).toContain("{unlocked ? name : t('newrun.locked')}");
    expect(collection).toContain('{richText(unlocked ? body : unlock)}');
    expect(collection).toContain(
      '{!unlocked && <span className="run-choice-lock" aria-hidden />}',
    );
    expect(collection).not.toContain('t(`record.${id}.unlock`)');
  });

  it('uses the generated pixel lock and readable highlighted Pouch effects', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const css = source('src/ui/styles/screens.css');
    const lock = readFileSync('src/ui/assets/pouch-lock.png');
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;

    expect(lock.readUInt32BE(16)).toBe(64);
    expect(lock.readUInt32BE(20)).toBe(64);
    expect(lock[25]).toBe(6);
    expect(component).toContain('<span className="run-choice-lock" aria-hidden />');
    expect(css).toContain("url('../assets/pouch-lock.png')");
    expect(css).toMatch(
      /\.collection-pouch-preview \.select-desc\s*\{[^}]*font-size:\s*var\(--fs-xl\);[^}]*font-weight:\s*800;/s,
    );
    expect(en['pouch.fiveColor.desc']).toContain('[n:+1]');
    expect(en['pouch.military.desc']).toContain('[p:Black & White Photo]');
    expect(ko['pouch.leather.desc']).toContain('[n:−1]');
    expect(ko['pouch.shoppingBasket.desc']).toContain('[p:스토리북]');
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
