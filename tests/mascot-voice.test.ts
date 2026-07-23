import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { resolve } from '../src/ui/i18n';

const EN = en as Record<string, string>;
const KO = ko as Record<string, string>;

const DICTS = { en: EN, ko: KO };

describe('t() key chains', () => {
  it('returns the first present key in the chain', () => {
    expect(resolve(DICTS, 'en', ['nope.absent.key', 'common.back'])).toBe(EN['common.back']);
  });

  it('falls through every absent key to the last key verbatim', () => {
    expect(resolve(DICTS, 'en', ['nope.a', 'nope.b'])).toBe('nope.b');
  });

  it('still resolves a plain string key', () => {
    expect(resolve(DICTS, 'ko', 'common.back')).toBe(KO['common.back']);
  });

  it('interpolates params through a chain', () => {
    expect(resolve(DICTS, 'en', ['nope.absent', 'collection.found'], { n: 7 })).toContain('7');
  });

  it('resolves the whole chain in the active language before falling to English', () => {
    // A synthetic dict pair: 'skin.line' exists only in ko, 'woodak.line'
    // exists in both. The active-language pass over the FULL chain must find
    // ko's 'skin.line' before any English fallback is even attempted — so a
    // skin's Korean line is never beaten by WooDak's English line.
    const synthetic = {
      en: { 'woodak.line': 'Hi (en)' },
      ko: { 'skin.line': '안녕 (ko)', 'woodak.line': '안녕 워댁 (ko)' },
    };
    expect(resolve(synthetic, 'ko', ['skin.line', 'woodak.line'])).toBe('안녕 (ko)');
  });
});
