import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('feedback 7 UI regressions', () => {
  const play = source('src/ui/styles/play.css');

  it('shakes the board rails without moving the fixed pouch', () => {
    const settle = source('src/ui/settle.tsx');
    expect(settle).toContain("'.persistent-run > .sidebar, .persistent-run > .main'");
    expect(settle).not.toContain("querySelector<HTMLElement>('.frame')");
    expect(play).toContain('.persistent-run > .sidebar.settle-shake');
    expect(play).not.toContain('.frame.settle-shake');
  });

  it('keeps pouch editions legible and counted', () => {
    const bag = source('src/ui/components/BagView.tsx');
    expect(bag).toContain('editions: Record<string, number>');
    expect(bag).toContain('Object.entries(full.editions)');
    expect(bag).toContain('<TileView tile={tile} inspectable tooltip={tileTooltip(tile, t)} />');
  });

  it('renders the internal Bold font as a counter-filled Void style', () => {
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    expect(ko['font.bold']).toBe('보이드');
    expect(en['font.bold']).toBe('Void');
    expect(play).toMatch(/\.tile\.f-bold \.tile-letter\s*\{[^}]*-webkit-text-stroke:\s*\.48em currentColor[^}]*transform:\s*scale\(\.61\)/s);
    expect(play).not.toContain('.tile.f-bold .tile-letter::after');
  });

  it('shows the permanent pouch in the shop instead of the completed blind remainder', () => {
    const runView = source('src/ui/components/RunView.tsx');
    const bag = source('src/ui/components/BagView.tsx');
    expect(runView).toContain("tiles={phase === 'shop' ? run.bag : blind.bag}");
    expect(bag).toContain('tiles: readonly Tile[]');
    expect(bag).not.toContain('pouchRemaining(blind)');
  });

  it('rounds edition layers to the same silhouette as shop tiles', () => {
    expect(play).toContain('--tile-radius: 10px');
    expect(play).toContain('border-radius: var(--tile-radius)');
    expect(play).toContain('border-radius: calc(var(--tile-radius) - 1px)');
  });

  it('shows the submitted sequence pattern with its current bonus score', () => {
    const runView = source('src/ui/components/RunView.tsx');
    const sidebar = source('src/ui/components/Sidebar.tsx');
    const stage = source('src/ui/components/StagePanel.tsx');
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    expect(runView).toContain('currentPattern={judgment.match?.pattern ?? null}');
    expect(sidebar).toContain("t('sidebar.currentPattern'");
    expect(sidebar).toContain('blind.projectedScore - blind.committedScore');
    expect(ko['sidebar.currentPattern']).toBe('{pattern} : {score}');
    expect(en['sidebar.currentPattern']).toBe('{pattern} : {score}');
    expect(sidebar).not.toContain("t('sidebar.forecast'");
    expect(stage).not.toContain('preview.sentenceBonus');
  });

  it('ranks current-run words by intrinsic letter chips instead of settled score', () => {
    const game = source('src/ui/useGame.ts');
    expect(game).toContain('const wordScore = letterChips(submission.tiles)');
    expect(game).toContain('wordScore > best.score');
    expect(game).not.toContain('submission.settledScore > best.score');
  });

  it('keeps additive Mult descriptions synchronized with the Korean +value form', () => {
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    const operators = (value: string) => [...value.matchAll(/\[m:([+−-]|×)/g)].map((m) => m[1]);
    for (const key of Object.keys(ko)) {
      expect(operators(en[key] ?? ''), key).toEqual(operators(ko[key] ?? ''));
    }
    expect(ko['jokerdesc.shortAndSharp']).toContain('[m:+10 배수]');
    expect(en['jokerdesc.shortAndSharp']).toContain('[m:+10 Mult]');
    expect(source('locales/en.json')).not.toContain('Adds [m:');
  });
});
