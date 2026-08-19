import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { MainMenu } from '../src/ui/components/MainMenu';
import { resetPersistedState } from '../src/ui/hooks';
import { I18nProvider } from '../src/ui/i18n';
import {
  createProfile,
  loadMainMenuProfileBase,
  resolveMainMenuProfile,
  selectProfileTitle,
} from '../src/ui/profile';
import { resetStorageCache, selectProfile, writeProfileValue } from '../src/ui/storage';

const source = (path: string): string => readFileSync(path, 'utf8');

class MemStorage {
  private map = new Map<string, string>();
  readonly reads = new Map<string, number>();
  getItem(key: string) {
    this.reads.set(key, (this.reads.get(key) ?? 0) + 1);
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

let storage: MemStorage;

const lexicon = makeLexicon(['plain'], {});
const noop = () => undefined;
const renderMenu = (withLexicon: boolean): string => renderToStaticMarkup(createElement(
  I18nProvider,
  null,
  createElement(MainMenu, {
    lexicon: withLexicon ? lexicon : null,
    onPlay: noop,
    onCollection: noop,
    onOptions: noop,
    onProfile: noop,
    onDeskLab: noop,
  }),
));

beforeEach(() => {
  storage = new MemStorage();
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage as unknown as Storage;
  delete (globalThis as { wj?: unknown }).wj;
  resetStorageCache();
  resetPersistedState();
});

describe('cosmetic profile-title UI', () => {
  it('uses accessible register buttons and one shared inline selector', () => {
    const profile = source('src/ui/components/Profile.tsx');
    expect(profile).toContain('aria-expanded={openRegister === suit}');
    expect(profile).toContain('<fieldset');
    expect(profile).toContain('type="radio"');
    expect(profile).toContain('name={`profile-title-${selectedSlot}`}');
    expect(profile).toContain('checked=');
    expect(profile).toContain('onChange=');
    expect(profile).toContain('autoFocus=');
    expect(profile).not.toContain('role="radio"');
    expect(profile.match(/name=\{`profile-title-\$\{selectedSlot\}`\}/g)).toHaveLength(2);
    expect(profile.match(/<label(?:\s|>)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(profile).toContain('reconcileProfileTitleFromSnapshot(');
  });

  it('validates only the active profile title on the Main Menu', () => {
    const menu = source('src/ui/components/MainMenu.tsx');
    const app = source('src/ui/App.tsx');
    expect(menu).toContain('const slot = activeProfile()');
    expect(menu).toContain('useMemo(() => loadMainMenuProfileBase(slot), [slot])');
    expect(menu).toContain('resolveMainMenuProfile(profileBase, lexicon)');
    expect(menu).not.toContain('loadLifetime(');
    expect(menu).not.toContain('unseenCount(');
    expect(menu).toContain('{profile.title && (');
    expect(app).toContain('lexicon={lexiconRef.current}');
    expect(app).toContain('scheduleWhenIdle(() => {');
    expect(app).toContain('void startLexiconLoad()');
    expect(app).toMatch(/startLexiconLoad[\s\S]*?lexiconIdleCancelRef\.current\?\.\(\)[\s\S]*?return ensureLexicon\(\)/);
    expect(app).toContain('if (!lexiconPromiseRef.current)');
  });

  it('shows only the active title after background lexicon arrival and hides None', () => {
    createProfile(2, 'Second');
    writeProfileValue('wj.collection', 2, { plain: 1 });
    expect(selectProfileTitle(lexicon, 2, 'standard.master')).toBe(true);

    expect(renderMenu(true)).not.toContain('menu-profile-title');
    selectProfile(2);
    expect(renderMenu(false)).toContain('Second');
    expect(renderMenu(false)).not.toContain('menu-profile-title');
    expect(renderMenu(true)).toContain('Master of Standard');
  });

  it('reads each raw profile value once and reuses the valid word keys', () => {
    const words = Array.from({ length: 10_000 }, (_, index) => `word${index}`);
    const base = makeLexicon(words, {});
    let lookups = 0;
    const countedLexicon = {
      ...base,
      lookup(text: string) {
        lookups += 1;
        return base.lookup(text);
      },
    };
    writeProfileValue('wj.lifetime', 1, {
      profileName: 'Reader',
      equippedRegisterTitle: 'standard.master',
      unlockAllApplied: false,
    });
    writeProfileValue('wj.collection', 1, {
      ...Object.fromEntries(words.map((word) => [word, 1])),
      broken: 'nope',
    });
    writeProfileValue('wj.collectionSeen', 1, 0);
    storage.reads.clear();

    const baseSnapshot = loadMainMenuProfileBase(1);
    const pending = resolveMainMenuProfile(baseSnapshot, null);
    const snapshot = resolveMainMenuProfile(baseSnapshot, countedLexicon);
    expect(pending.title).toBeNull();
    expect(snapshot).toMatchObject({ name: 'Reader', unseen: 10_000 });
    expect(snapshot.title?.id).toBe('standard.master');
    expect(lookups).toBe(10_000);
    expect(storage.reads).toEqual(new Map([
      ['wj.lifetime', 1],
      ['wj.collection', 1],
      ['wj.collectionSeen', 1],
    ]));
  });
});
