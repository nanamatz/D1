import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { availableNewRunTabs, NewRun } from '../src/ui/components/NewRun';
import { I18nProvider } from '../src/ui/i18n';
import en from '../locales/en.json';

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
    expect(css).toMatch(/\.newrun-panel\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) 82px 32px/s);
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

  it('ships the accessible DEV-only Challenge surface with localized progress', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const challenges = source('src/ui/components/NewRunChallenges.tsx');
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
    expect(component.match(/role="tabpanel"/g)).toHaveLength(1);
    expect(component).toContain('const NewRunChallenges = import.meta.env.DEV');
    expect(component).toContain('availableNewRunTabs(challengesAvailable, canContinue)');
    expect(app).toContain('showChallenges={import.meta.env.DEV}');
    expect(component).not.toContain('challenge-list');
    expect(component).not.toContain("t('challenge.start')");
    expect(challenges).toContain('aria-pressed={challengeId === def.id}');
    expect(challenges).toContain('disabled={lifetime.challengesDisabled}');
    expect(challenges).toContain('customSeed: false');
    expect(challenges).toContain('className="challenge-list"');
    expect(challenges).not.toContain('className="challenge-copy"');
    expect(challenges).not.toContain('t(`challenge.${challenge.id}.desc`)');
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

  it('keeps one shared shell, fixed slots, and one Back control', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(component.match(/className="panel newrun-modal"/g)).toHaveLength(1);
    expect(component.match(/className="btn back-bar"/g)).toHaveLength(1);
    expect(component).toContain('className="newrun-content');
    expect(component).toContain('className="newrun-action-row"');
    expect(component).toContain('className="newrun-note-row"');
    expect(css).toMatch(/\.newrun-modal\s*\{[^}]*width:\s*min\(720px, 96vw\)[^}]*grid-template-rows:/s);
    expect(css).toMatch(/\.newrun-modal\s*\{[^}]*height:\s*700px/s);
    expect(css).not.toMatch(/\.newrun-modal\s*\{[^}]*height:\s*(?:min\([^;]*100%|calc\(100%)/s);
    expect(css).toMatch(/\.newrun-content\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).not.toContain('scrollbar-gutter: stable');
    expect(css).not.toContain('overflow-wrap: anywhere');
    expect(css).toMatch(/\.continue-summary \.cs-seed\s*\{[^}]*overflow-x:\s*auto[^}]*white-space:\s*nowrap/s);
    expect(css).toMatch(/\.newrun-action-row\s*\{[^}]*min-height:\s*82px/s);
    expect(css).toMatch(/\.newrun-action-row \.play-run\s*\{[^}]*340px/s);
  });

  it('renders committed Continue facts with real objects and preserves a saved Challenge in production', () => {
    const markup = renderToStaticMarkup(createElement(
      I18nProvider,
      null,
      createElement(NewRun, {
        initialPouchId: 'green',
        initialRecordId: 'redLp',
        showChallenges: false,
        onStart: () => undefined,
        onBack: () => undefined,
        onContinue: () => undefined,
        continueInfo: {
          ante: 9,
          blindKind: 'big',
          gold: 17,
          seed: 'CONTINUE-SEED',
          pouchId: 'green',
          recordId: 'redLp',
          committedScore: 1234,
          target: 5000,
          bestWord: { text: 'word', score: 999 },
          challengeId: 'redPen',
        },
      }),
    ));
    const app = source('src/ui/App.tsx');
    const component = source('src/ui/components/NewRun.tsx');

    expect(markup.match(/role="tab"/g)).toHaveLength(2);
    expect(markup).not.toContain(en['newrun.tab.challenges']);
    expect(markup).toContain('continue-object-art-pouch');
    expect(markup).toContain('continue-object-art-record');
    expect(markup).toContain('run-choice-art run-choice-art-pouch continue-object-art');
    expect(markup).toContain('run-choice-art run-choice-art-record continue-object-art');
    expect(markup).toContain(en['pouch.green.name']);
    expect(markup).toContain(en['record.redLp.name']);
    expect(markup).toContain('1.2K / 5K');
    expect(markup).toContain('$17');
    expect(markup).toContain('WORD · 999');
    expect(markup).toContain('CONTINUE-SEED');
    expect(markup).toContain(`Challenge: ${en['challenge.redPen.name']}`);
    expect(markup).toContain('Chapter 9 · Revision');
    expect(markup).not.toContain('9/8');
    expect(markup.match(/class="btn back-bar"/g)).toHaveLength(1);
    expect(app).toContain('committedScore: g.state.blind.committedScore');
    expect(app).toContain('target: g.state.blind.target');
    expect(app).toContain('bestWord: g.state.stats.bestWord');
    expect(component).not.toContain('projectedScore');
    expect(component).not.toContain('finalScore');
    expect(component).toContain(": '—';");
  });

  it('reuses the New Run Pouch and Record art dimensions in Continue', () => {
    const component = source('src/ui/components/NewRun.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(component).toContain(
      'className: `run-choice-art run-choice-art-${kind} continue-object-art continue-object-art-${kind}`',
    );
    expect(css).toMatch(/\.run-choice-art\s*\{[^}]*width:\s*140px[^}]*height:\s*140px/s);
    expect(css).toMatch(/\.run-choice-art-record\s*\{[^}]*width:\s*88px[^}]*height:\s*88px/s);
    expect(css).toMatch(/\.run-choice-art img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*contain[^}]*image-rendering:\s*pixelated[^}]*filter:\s*url\(#unlock-chroma\)/s);
    expect(css).toMatch(/\.select-preview > \.tt-anchor,\s*\.continue-object-row > \.tt-anchor\s*\{[^}]*justify-self:\s*center/s);
    expect(css).toMatch(/\.continue-object-row\s*\{[^}]*grid-template-columns:\s*148px/s);
    expect(css).toMatch(/\.continue-record-row\s*\{[^}]*grid-template-columns:\s*92px/s);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.run-choice-art\s*\{[^}]*width:\s*92px[^}]*height:\s*92px/s);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.run-choice-art-record\s*\{[^}]*width:\s*68px[^}]*height:\s*68px/s);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.continue-object-row\s*\{[^}]*grid-template-columns:\s*96px/s);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.continue-record-row\s*\{[^}]*grid-template-columns:\s*72px/s);
    expect(css).not.toMatch(/\.continue-object-art(?:-record)?\s*\{[^}]*\b(?:width|height):/s);
  });

  it('builds exactly two production tabs and three DEV tabs', () => {
    expect(availableNewRunTabs(false, true).map(({ id }) => id)).toEqual(['new', 'continue']);
    expect(availableNewRunTabs(true, true).map(({ id }) => id)).toEqual([
      'new', 'continue', 'challenges',
    ]);
    expect(availableNewRunTabs(false, false)[1]).toEqual({ id: 'continue', disabled: true });

    const noSaveMarkup = renderToStaticMarkup(createElement(
      I18nProvider,
      null,
      createElement(NewRun, {
        showChallenges: false,
        onStart: () => undefined,
        onBack: () => undefined,
      }),
    ));
    expect(noSaveMarkup).toContain('id="newrun-tab-new" role="tab" aria-selected="true"');
    expect(noSaveMarkup).toMatch(/id="newrun-tab-continue"[^>]*disabled=""/);
    expect(noSaveMarkup).not.toContain('newrun-tab-challenges');
  });
});
