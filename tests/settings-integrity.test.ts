import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { usePersistedState, resetPersistedState } from '../src/ui/hooks';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/ui/settings';

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
      master: 80,
      music: 0,
      crtEnabled: true,
      crtIntensity: 100,
      crtBloom: true,
      mascot: 'woodak',
    });
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
