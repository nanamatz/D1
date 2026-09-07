import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import ja from '../locales/ja.json';
import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';
import ptBR from '../locales/pt-BR.json';
import de from '../locales/de.json';
import esES from '../locales/es-ES.json';
import frFR from '../locales/fr-FR.json';
import ruRU from '../locales/ru-RU.json';
import { SteamOwnershipNotice } from '../src/ui/components/SteamOwnershipNotice';
import { resetPersistedState } from '../src/ui/hooks';
import { I18nProvider, useI18n } from '../src/ui/i18n';
import { resetStorageCache, type StorageBridge } from '../src/ui/storage';

class MemStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

function installBridge(
  languageHint: 'en' | 'ko' | 'ja' | 'zh-CN' | 'zh-TW' | 'pt-BR' | 'de' | 'es-ES' | 'fr-FR' | 'ru-RU',
  steamStatus: StorageBridge['steamStatus'] = 'claim-required',
) {
  (globalThis as { wj?: StorageBridge }).wj = {
    snapshot: {}, fresh: false, languageHint, steamStatus,
    write: () => undefined, remove: () => undefined,
  };
  resetStorageCache();
}

function renderNotice() {
  return renderToStaticMarkup(
    createElement(I18nProvider, null, createElement(SteamOwnershipNotice)),
  );
}

function LanguageProbe() {
  return createElement('span', null, useI18n().lang);
}

function renderLanguage() {
  return renderToStaticMarkup(createElement(I18nProvider, null, createElement(LanguageProbe)));
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage() as unknown as Storage;
  delete (globalThis as { wj?: StorageBridge }).wj;
  resetStorageCache();
  resetPersistedState();
});

describe('Steam startup language', () => {
  it('renders the first ownership decision in Korean without persisting detection', () => {
    installBridge('ko');
    const html = renderNotice();
    expect(html).toContain(ko['steam.owner.claim-required.title']);
    expect(html).toContain(ko['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in Japanese without persisting detection', () => {
    installBridge('ja');
    const html = renderNotice();
    expect(html).toContain(ja['steam.owner.claim-required.title']);
    expect(html).toContain(ja['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in Simplified Chinese without persisting detection', () => {
    installBridge('zh-CN');
    const html = renderNotice();
    expect(html).toContain(zhCN['steam.owner.claim-required.title']);
    expect(html).toContain(zhCN['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in Traditional Chinese without persisting detection', () => {
    installBridge('zh-TW');
    const html = renderNotice();
    expect(html).toContain(zhTW['steam.owner.claim-required.title']);
    expect(html).toContain(zhTW['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in Brazilian Portuguese without persisting detection', () => {
    installBridge('pt-BR');
    const html = renderNotice();
    expect(html).toContain(ptBR['steam.owner.claim-required.title']);
    expect(html).toContain(ptBR['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in German without persisting detection', () => {
    installBridge('de');
    const html = renderNotice();
    expect(html).toContain(de['steam.owner.claim-required.title']);
    expect(html).toContain(de['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in European Spanish without persisting detection', () => {
    installBridge('es-ES');
    const html = renderNotice();
    expect(html).toContain(esES['steam.owner.claim-required.title']);
    expect(html).toContain(esES['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in French without persisting detection', () => {
    installBridge('fr-FR');
    const html = renderNotice();
    expect(html).toContain(frFR['steam.owner.claim-required.title']);
    expect(html).toContain(frFR['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('renders the first ownership decision in Russian without persisting detection', () => {
    installBridge('ru-RU');
    const html = renderNotice();
    expect(html).toContain(ruRU['steam.owner.claim-required.title']);
    expect(html).toContain(ruRU['steam.owner.accept']);
    expect(localStorage.getItem('wj.lang')).toBeNull();
  });

  it('lets a valid saved language override the Steam hint', () => {
    localStorage.setItem('wj.lang', JSON.stringify('en'));
    installBridge('ko');
    expect(renderNotice()).toContain(en['steam.owner.claim-required.title']);
  });

  it('ignores an invalid saved language and uses the sanitized Steam hint', () => {
    localStorage.setItem('wj.lang', JSON.stringify('koreana'));
    installBridge('ko');
    expect(renderNotice()).toContain(ko['steam.owner.claim-required.title']);
  });

  it('defaults direct and web launches to English', () => {
    expect(renderLanguage()).toContain('>en<');
  });

  it('keeps ownership gating unchanged', () => {
    installBridge('ko', 'eligible');
    expect(renderNotice()).toBe('');
  });
});
