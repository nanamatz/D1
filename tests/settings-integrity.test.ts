import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { usePersistedState, resetPersistedState } from '../src/ui/hooks';
import { DEFAULT_SETTINGS, normalizeSettings, useSettings, type Settings } from '../src/ui/settings';

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true });

afterEach(() => {
  values.clear();
  resetPersistedState();
});

describe('settings integrity', () => {
  it('fills partial legacy settings and rejects corrupt values', () => {
    expect(normalizeSettings({ tips: false })).toEqual({
      ...DEFAULT_SETTINGS,
      tips: false,
    });
    expect(normalizeSettings({
      gameSpeed: 3,
      uiScale: 999,
      master: Number.NaN,
      music: -1,
      crtEnabled: 'yes',
      crtIntensity: 999,
      crtBloom: null,
      mascot: 'unknown',
    })).toMatchObject({
      gameSpeed: 1,
      uiScale: 120,
      music: 0,
      sfx: 64,
      musicMuted: false,
      sfxMuted: false,
      crtEnabled: true,
      crtIntensity: 100,
      crtBloom: true,
      mascot: 'woodak',
    });
  });

  it('migrates legacy speed and master exactly once, then ignores stale master', () => {
    const migrated = normalizeSettings({ gameSpeed: 4, master: 80, music: 70, sfx: 80 });
    expect(migrated).toMatchObject({
      gameSpeed: 2,
      music: 56,
      sfx: 64,
      musicMuted: false,
      sfxMuted: false,
    });
    expect('master' in migrated).toBe(false);
    expect(normalizeSettings(migrated)).toEqual(migrated);

    expect(normalizeSettings({ master: 0, music: 35, sfx: 45 })).toMatchObject({
      music: 35,
      sfx: 45,
      musicMuted: true,
      sfxMuted: true,
    });
    expect(normalizeSettings({
      master: 0,
      music: 72,
      sfx: 63,
      musicMuted: false,
      sfxMuted: true,
    })).toMatchObject({
      music: 72,
      sfx: 63,
      musicMuted: false,
      sfxMuted: true,
    });
  });

  it('honors the first requested legacy write before persisting the migrated shape', () => {
    const writeFirst = <K extends keyof Settings>(key: K, value: Settings[K]): Settings => {
      values.set('wj.settings', JSON.stringify({ gameSpeed: 4, master: 80, music: 70, sfx: 80 }));
      resetPersistedState();
      let set!: ReturnType<typeof useSettings>['set'];
      function Capture() {
        ({ set } = useSettings());
        return null;
      }
      renderToStaticMarkup(createElement(Capture));
      set(key, value);
      return JSON.parse(values.get('wj.settings')!);
    };

    for (const [key, value] of [
      ['music', 50],
      ['musicMuted', true],
      ['gameSpeed', 1],
    ] as const) {
      const saved = writeFirst(key, value);
      expect(saved[key]).toBe(value);
      expect('master' in saved).toBe(false);
      expect(saved).toMatchObject({ musicMuted: key === 'musicMuted', sfxMuted: false });
    }
  });

  it('shares one value so a later functional update cannot restore stale fields', () => {
    type Value = { master: number; fullscreen: boolean };
    type Setter = ReturnType<typeof usePersistedState<Value>>[1];
    let first!: Setter;
    let secondValue!: Value;

    function First() {
      [, first] = usePersistedState<Value>('test.settings', {
        master: 80,
        fullscreen: false,
      });
      return null;
    }
    function Second() {
      [secondValue] = usePersistedState<Value>('test.settings', {
        master: 80,
        fullscreen: false,
      });
      return null;
    }

    renderToStaticMarkup(createElement(First));
    first((current) => ({ ...current, master: 0 }));
    renderToStaticMarkup(createElement(Second));
    expect(secondValue.master).toBe(0);

    first((current) => ({ ...current, fullscreen: true }));
    renderToStaticMarkup(createElement(Second));
    expect(secondValue).toEqual({ master: 0, fullscreen: true });
  });
});
