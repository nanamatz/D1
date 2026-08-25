import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('New Run selector presentation', () => {
  it('starts on the Pouch and Record used by the current or most recent run', () => {
    const app = source('src/ui/App.tsx');
    const component = source('src/ui/components/NewRun.tsx');

    expect(app).toContain('initialPouchId={g.state.run.pouchId}');
    expect(app).toContain('initialRecordId={g.state.run.recordId}');
    expect(component).toContain('useState<PouchId>(initialPouchId)');
    expect(component).toContain('useState<RecordId>(initialRecordId)');
    expect(component).toContain("initialPouchId = 'yellow'");
    expect(component).toContain("initialRecordId = 'whiteLp'");
  });

  it('uses circular stacked arrow-panel-arrow rows with a compact Record tier', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(component).toContain('className="run-choice-stage"');
    expect(component).toContain('className="carousel-dots"');
    expect(component).toContain('(index + delta + ids.length) % ids.length');
    expect(component).toContain('disabled={disabled}');
    expect(component).not.toContain('index === 0');
    expect(component).not.toContain('index === ids.length - 1');
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

  it('ships the accessible three-tab Challenge surface with localized progress', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const app = source('src/ui/App.tsx');
    const runInfo = source('src/ui/components/RunInfo.tsx');
    const gameOver = source('src/ui/components/GameOver.tsx');
    const options = source('src/ui/components/Options.tsx');
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;

    expect(component).toContain('role="tablist"');
    expect(component).toContain('role="tab"');
    expect(component).toContain('aria-selected={active === id}');
    expect(component).toContain('aria-controls={`newrun-panel-${id}`}');
    expect(component.match(/role="tabpanel"/g)).toHaveLength(3);
    expect(component).toContain('aria-pressed={challengeId === def.id}');
    expect(component).toContain('disabled={lifetime.challengesDisabled}');
    expect(component).toContain('customSeed: false');
    expect(component).not.toContain('challengeSeed');
    expect(app).toContain('challengeId: g.state.run.challengeId ?? null');
    expect(runInfo).toContain("t(`challenge.${run.challengeId}.name`)");
    expect(gameOver).toContain('challenge-complete-banner');
    expect(options).toContain('lt.completedChallenges.length');

    for (const id of ['redPen', 'risingQuota', 'narrowDesk', 'threePasses', 'balancedBurden', 'randomFinal']) {
      expect(en[`challenge.${id}.name`]).toBeTruthy();
      expect(en[`challenge.${id}.desc`]).toBeTruthy();
      expect(ko[`challenge.${id}.name`]).toBeTruthy();
      expect(ko[`challenge.${id}.desc`]).toBeTruthy();
    }
  });
});
