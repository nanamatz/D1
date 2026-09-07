/**
 * Minimal i18n (P1-4). All UI chrome lives in locales/*.json; game
 * words/tiles stay English by design. `t(key, params)` does {param} interpolation
 * and falls back to English then the raw key.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import en from '../../locales/en.json';
import ko from '../../locales/ko.json';
import ja from '../../locales/ja.json';
import zhCN from '../../locales/zh-CN.json';
import zhTW from '../../locales/zh-TW.json';
import ptBR from '../../locales/pt-BR.json';
import de from '../../locales/de.json';
import esES from '../../locales/es-ES.json';
import frFR from '../../locales/fr-FR.json';
import ruRU from '../../locales/ru-RU.json';
import { usePersistedState } from './hooks';
import { steamLanguageHint } from './storage';

export const LANGUAGES = [
  { id: 'en', label: 'English', locale: 'en-US' },
  { id: 'ko', label: '한국어', locale: 'ko-KR' },
  { id: 'ja', label: '日本語', locale: 'ja-JP' },
  { id: 'zh-CN', label: '简体中文', locale: 'zh-CN' },
  { id: 'zh-TW', label: '繁體中文', locale: 'zh-TW' },
  { id: 'pt-BR', label: 'Português (Brasil)', locale: 'pt-BR' },
  { id: 'de', label: 'Deutsch', locale: 'de-DE' },
  { id: 'es-ES', label: 'Español (España)', locale: 'es-ES' },
  { id: 'fr-FR', label: 'Français', locale: 'fr-FR' },
  { id: 'ru-RU', label: 'Русский', locale: 'ru-RU' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['id'];
export const isLang = (value: unknown): value is Lang =>
  LANGUAGES.some(({ id }) => id === value);
const DICTS: Record<Lang, Record<string, string>> = {
  en: en as Record<string, string>,
  ko: ko as Record<string, string>,
  ja: ja as Record<string, string>,
  'zh-CN': zhCN as Record<string, string>,
  'zh-TW': zhTW as Record<string, string>,
  'pt-BR': ptBR as Record<string, string>,
  de: de as Record<string, string>,
  'es-ES': esES as Record<string, string>,
  'fr-FR': frFR as Record<string, string>,
  'ru-RU': ruRU as Record<string, string>,
};

export type TParams = Record<string, string | number>;
export type ObjectNameKind = 'joker' | 'voucher' | 'boss' | 'gambler';

/** All object-name surfaces use the same locale key instead of branching on EN/KO. */
export const objectName = (
  t: (key: string) => string,
  kind: ObjectNameKind,
  id: string,
): string => t(`object.${kind}.${id}`);

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
  dicts: Record<string, Record<string, string>> & { en: Record<string, string> },
  lang: Lang,
  key: string | string[],
  params?: TParams,
): string {
  const keys = Array.isArray(key) ? key : [key];
  let s =
    keys.map((k) => dicts[lang]?.[k]).find((v) => v !== undefined) ??
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
  const lang: Lang = isLang(storedLang)
    ? storedLang
    : steamLanguageHint() ?? 'en';
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
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
