/**
 * Minimal i18n (P1-4). All UI chrome lives in locales/en.json + ko.json; game
 * words/tiles stay English by design. `t(key, params)` does {param} interpolation
 * and falls back to English then the raw key.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import en from '../../locales/en.json';
import ko from '../../locales/ko.json';
import { usePersistedState } from './hooks';
import { steamLanguageHint } from './storage';

export type Lang = 'en' | 'ko';
const DICTS: Record<Lang, Record<string, string>> = {
  en: en as Record<string, string>,
  ko: ko as Record<string, string>,
};

export type TParams = Record<string, string | number>;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** A plain key, or an ordered chain: the first key present wins. Used by the
   *  mascot voice router (mascots.ts `voicedKeys`) to fall back to WooDak's line. */
  t: (key: string | string[], params?: TParams) => string;
}

/** Resolve a key (or an ordered chain — first key present wins) against the
 *  language dict, then English, then the last key verbatim; then interpolate
 *  {param} placeholders. Pure and exported so tests exercise the real resolver
 *  rather than a copy of it. */
export function resolve(
  dicts: Record<Lang, Record<string, string>>,
  lang: Lang,
  key: string | string[],
  params?: TParams,
): string {
  const keys = Array.isArray(key) ? key : [key];
  let s =
    keys.map((k) => dicts[lang][k]).find((v) => v !== undefined) ??
    keys.map((k) => dicts.en[k]).find((v) => v !== undefined) ??
    keys[keys.length - 1]!;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [storedLang, setStoredLang] = usePersistedState<unknown>('wj.lang', null);
  const lang: Lang = storedLang === 'en' || storedLang === 'ko'
    ? storedLang
    : steamLanguageHint() ?? 'en';
  const setLang = useCallback((next: Lang) => setStoredLang(next), [setStoredLang]);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, params) => resolve(DICTS, lang, key, params),
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
