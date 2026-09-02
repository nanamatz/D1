import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
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
  languageHint: 'en' | 'ko',
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
