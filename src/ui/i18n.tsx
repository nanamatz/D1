/**
 * Minimal i18n (P1-4). All UI chrome lives in locales/en.json + ko.json; game
 * words/tiles stay English by design. `t(key, params)` does {param} interpolation
 * and falls back to English then the raw key.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import en from '../../locales/en.json';
import ko from '../../locales/ko.json';
import { usePersistedState } from './hooks';

export type Lang = 'en' | 'ko';
const DICTS: Record<Lang, Record<string, string>> = {
  en: en as Record<string, string>,
  ko: ko as Record<string, string>,
};

export type TParams = Record<string, string | number>;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: TParams) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePersistedState<Lang>('wj.lang', 'en');
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, params) => {
        let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
        }
        return s;
      },
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
