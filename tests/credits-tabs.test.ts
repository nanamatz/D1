import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Credits tabs', () => {
  it('separates team, visual, audio, and font attribution in both languages', () => {
    const component = source('src/ui/components/Options.tsx');
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;

    expect(component).toContain("['team', 'visuals', 'audio', 'fonts']");
    expect(component).toContain('role="tablist"');
    expect(component).toContain('role="tabpanel"');
    expect(component).toContain('Ben Kim');
    expect(component).toContain('<details className="cr-legal">');
    expect(component).toContain('<summary>{t(\'credits.legal.open\')}</summary>');
    expect(component).toContain('© 2026 Ben Kim');
    expect(en['credits.aiTools']).toBe('AI production tools: ChatGPT (OpenAI) · Claude (Anthropic)');
    expect(ko['credits.audioSource']).toContain('Casino Audio 1.1');
    expect(en['credits.audioSource']).not.toContain('No external samples');
    expect(en['credits.fontSource']).toContain('SIL Open Font License 1.1');
  });
});
