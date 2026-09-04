import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/ui/components/Options.tsx', 'utf8');
const css = readFileSync('src/ui/styles/screens.css', 'utf8');
const locales = ['en', 'ko'].map((lang) => JSON.parse(
  readFileSync(`locales/${lang}.json`, 'utf8'),
) as Record<string, string>);

describe('Settings tooltip coverage', () => {
  it('ships paired descriptions for all 14 value settings', () => {
    for (const locale of locales) {
      expect(Object.keys(locale).filter((key) => key.startsWith('settings.tooltip.'))).toHaveLength(14);
      expect(Object.keys(locale).filter((key) => key.startsWith('settings.audition.'))).toHaveLength(0);
    }
    expect(source.match(/tooltipDisabled={tab !==/g)).toHaveLength(11);
    expect(source.match(/disabled={tab !==/g)).toHaveLength(3);
  });

  it('accounts for every one of the 18 native Settings focus targets', () => {
    const sliders = source.match(/<Slider\b/g)?.length ?? 0;
    const toggles = source.match(/<Toggle\b/g)?.length ?? 0;
    const speedChoices = 2;
    const languageChoices = 1;
    const muteChoices = 2;
    const resolutionChoices = 1;
    const paletteChoices = 1;

    expect(sliders).toBe(5);
    expect(toggles).toBe(6);
    expect(source).toContain('([1, 2] as const)');
    expect(source).not.toContain("settings.master");
    expect(source.match(/type="checkbox"/g)).toHaveLength(1);
    expect(source.match(/label: t\('settings\.mute'\)/g)).toHaveLength(2);
    expect(source).toContain("ariaLabel: t('settings.musicMute')");
    expect(source).toContain("ariaLabel: t('settings.sfxMute')");
    expect(source).toContain('aria-label={mute.ariaLabel}');
    for (const locale of locales) {
      expect(locale['settings.audioNote']).toMatch(/^(Audio|오디오)$/);
      expect(locale['settings.mute']).toMatch(/^(Mute|음소거)$/);
    }
    expect(source).toContain('className="resolution-select"');
    expect(source).toContain('className="btn exchange sm"');
    expect(sliders + toggles + speedChoices + languageChoices + muteChoices
      + resolutionChoices + paletteChoices).toBe(18);
  });

  it('aligns both audio buses on the same responsive four-column grid', () => {
    expect(source).toContain("mute && 'audio-set-row'");
    expect(css).toContain('grid-template-columns: minmax(72px, 1fr) minmax(140px, 160px) 44px 76px;');
    expect(css).toContain('.audio-set-row .set-control { display: contents; }');
    expect(css).toContain('font-variant-numeric: tabular-nums;');
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('grid-template-columns: 64px minmax(96px, 1fr) 36px 68px;');
  });

  it('does not expose audio-preview controls', () => {
    expect(source).not.toContain('settings.audition');
    expect(source).not.toContain('auditionMusic');
    expect(source).not.toContain('preventDefault');
  });
});
