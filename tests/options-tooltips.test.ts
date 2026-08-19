import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/ui/components/Options.tsx', 'utf8');
const locales = ['en', 'ko'].map((lang) => JSON.parse(
  readFileSync(`locales/${lang}.json`, 'utf8'),
) as Record<string, string>);

describe('Settings tooltip coverage', () => {
  it('ships paired descriptions for all 14 value settings', () => {
    for (const locale of locales) {
      expect(Object.keys(locale).filter((key) => key.startsWith('settings.tooltip.'))).toHaveLength(14);
      expect(Object.keys(locale).filter((key) => key.startsWith('settings.audition.'))).toHaveLength(0);
    }
    expect(source.match(/tooltipDisabled={tab !==/g)).toHaveLength(12);
    expect(source.match(/disabled={tab !==/g)).toHaveLength(2);
  });

  it('accounts for every one of the 16 native Settings focus targets', () => {
    const sliders = source.match(/<Slider\b/g)?.length ?? 0;
    const toggles = source.match(/<Toggle\b/g)?.length ?? 0;
    const speedChoices = 3;
    const languageChoices = 1;

    expect(sliders).toBe(6);
    expect(toggles).toBe(6);
    expect(source).toContain('([1, 2, 4] as const)');
    expect(sliders + toggles + speedChoices + languageChoices).toBe(16);
  });

  it('does not expose audio-preview controls', () => {
    expect(source).not.toContain('settings.audition');
    expect(source).not.toContain('auditionMusic');
    expect(source).not.toContain('preventDefault');
  });
});
