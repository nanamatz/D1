import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectionProgressPercent, Slider, Toggle } from '../src/ui/components/Options';
import { I18nProvider } from '../src/ui/i18n';

describe('Options completion regressions', () => {
  it('gives reusable sliders and switches programmatic names', () => {
    const slider = renderToStaticMarkup(createElement(I18nProvider, null, createElement(Slider, {
      label: 'CRT intensity', value: 50, min: 0, max: 100, onChange: () => {},
      tooltip: 'Scanline darkness', tooltipDisabled: false,
    })));
    const toggle = renderToStaticMarkup(createElement(I18nProvider, null, createElement(Toggle, {
      label: 'CRT effect', on: true, onChange: () => {},
      tooltip: 'Complete CRT pass', tooltipDisabled: false,
    })));
    expect(slider).toContain('aria-label="CRT intensity"');
    expect(toggle).toContain('aria-label="CRT effect"');
  });

  it('shows Reveal All as 100% without fake words and clamps canonical discovery', () => {
    const lexicon = { size: 1, isWord: (word: string) => word === 'cat' };
    expect(collectionProgressPercent({}, lexicon, true)).toBe(100);
    expect(collectionProgressPercent({}, lexicon, false)).toBe(0);
    expect(collectionProgressPercent({
      cat: { firstPlayedAt: 1, plays: 1, bestScore: 15 },
      stale: { firstPlayedAt: 2, plays: 1, bestScore: 1 },
      oversized: { firstPlayedAt: 3, plays: 1, bestScore: 1 },
    }, lexicon, false)).toBe(100);
  });

  it('keeps equal-height Settings panels stacked while hiding inactive controls', () => {
    const component = readFileSync(new URL('../src/ui/components/Options.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../src/ui/styles/screens.css', import.meta.url), 'utf8');
    expect(component).not.toMatch(/\shidden=\{tab !==/);
    expect(component.match(/aria-hidden=\{tab !==/g)).toHaveLength(3);
    expect(component).toContain("(['game', 'video', 'audio'] as Tab[])");
    expect(component).not.toContain('settings-graphics');
    expect(css).toMatch(/\.set-tabpanel\s*\{[\s\S]*visibility:\s*hidden;[\s\S]*pointer-events:\s*none;/);
    expect(css).toMatch(/\.set-tabpanel\.on\s*\{[\s\S]*visibility:\s*visible;[\s\S]*pointer-events:\s*auto;/);
  });

  it('keeps every visual control in Video after Resolution', () => {
    const component = readFileSync(new URL('../src/ui/components/Options.tsx', import.meta.url), 'utf8');
    const video = component.slice(
      component.indexOf('id="settings-video"'),
      component.indexOf('id="settings-audio"'),
    );
    const labels = [
      'settings.resolution',
      'settings.fullscreen',
      'settings.uiScale',
      'settings.crtEnabled',
      'settings.crtIntensity',
      'settings.crtBloom',
    ];
    for (const label of labels) expect(video.indexOf(label)).toBeGreaterThanOrEqual(0);
    for (let index = 1; index < labels.length; index += 1) {
      expect(video.indexOf(labels[index]!)).toBeGreaterThan(video.indexOf(labels[index - 1]!));
    }
  });

  it('keeps dividers between tooltip-wrapped Settings rows', () => {
    const css = readFileSync(new URL('../src/ui/styles/screens.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.set-row:last-child\s*\{/);
    expect(css).toMatch(/\.set-tabpanel\s*>\s*\.tt-anchor:last-child\s*>\s*\.set-row\s*\{[^}]*border-bottom:\s*none;/s);
  });
});
