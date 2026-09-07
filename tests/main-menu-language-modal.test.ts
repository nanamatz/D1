import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main-menu language modal', () => {
  const menu = readFileSync('src/ui/components/MainMenu.tsx', 'utf8');
  const i18n = readFileSync('src/ui/i18n.tsx', 'utf8');
  const css = readFileSync('src/ui/styles/screens.css', 'utf8');

  it('opens a native modal with the supported language choices', () => {
    expect(menu).toContain('!languageDialog.current?.open');
    expect(menu).toContain('languageDialog.current?.showModal()');
    expect(menu).toContain('LANGUAGES.map((choice) =>');
    expect(i18n).toContain("{ id: 'en', label: 'English', locale: 'en-US' }");
    expect(i18n).toContain("{ id: 'ko', label: '한국어', locale: 'ko-KR' }");
    expect(i18n).toContain("{ id: 'ja', label: '日本語', locale: 'ja-JP' }");
    expect(i18n).toContain("{ id: 'zh-CN', label: '简体中文', locale: 'zh-CN' }");
    expect(i18n).toContain("{ id: 'zh-TW', label: '繁體中文', locale: 'zh-TW' }");
    expect(i18n).toContain("{ id: 'pt-BR', label: 'Português (Brasil)', locale: 'pt-BR' }");
    expect(i18n).toContain("{ id: 'de', label: 'Deutsch', locale: 'de-DE' }");
    expect(i18n).toContain("{ id: 'es-ES', label: 'Español (España)', locale: 'es-ES' }");
    expect(i18n).toContain("{ id: 'fr-FR', label: 'Français', locale: 'fr-FR' }");
    expect(i18n).toContain("{ id: 'ru-RU', label: 'Русский', locale: 'ru-RU' }");
    expect(menu).toContain('aria-pressed={lang === choice.id}');
    expect(menu).toContain("onClose={() => setLanguageOpen(false)}");
  });

  it('uses an expandable desktop grid and a narrow-screen fallback', () => {
    expect(css).toMatch(/\.language-grid\s*{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/s);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*\.language-grid\s*{\s*grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/\.language-modal \.back-bar\s*{[^}]*width:\s*100%;[^}]*margin-inline:\s*auto;/s);
  });
});
