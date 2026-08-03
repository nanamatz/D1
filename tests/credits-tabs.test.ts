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
    expect(en['credits.aiTools']).toContain('ChatGPT by OpenAI · Claude by Anthropic');
    expect(ko['credits.audioSource']).toContain('외부 샘플이나 제3자 오디오 파일은 사용하지 않았습니다');
    expect(en['credits.fontSource']).toContain('SIL Open Font License 1.1');
  });
});
