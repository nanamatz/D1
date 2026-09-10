import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
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
import plPL from '../locales/pl-PL.json';
import trTR from '../locales/tr-TR.json';
import { resolve } from '../src/ui/i18n';
import { voiceChain, WOODAK_SKINS } from '../src/ui/mascots';
import { ENCOUNTERS } from '../src/ui/tutorial';

const EN = en as Record<string, string>;
const KO = ko as Record<string, string>;

const DICTS = { en: EN, ko: KO };
const LOCALES: Record<string, Record<string, string>> = {
  en: EN,
  ko: KO,
  ja: ja as Record<string, string>,
  'zh-CN': zhCN as Record<string, string>,
  'zh-TW': zhTW as Record<string, string>,
  'pt-BR': ptBR as Record<string, string>,
  de: de as Record<string, string>,
  'es-ES': esES as Record<string, string>,
  'fr-FR': frFR as Record<string, string>,
  'ru-RU': ruRU as Record<string, string>,
  'pl-PL': plPL as Record<string, string>,
  'tr-TR': trTR as Record<string, string>,
};

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
    // A synthetic dict pair that distinguishes language-first from per-key fallback:
    // 'skin.line' exists only in en, 'woodak.line' exists only in ko. The
    // active-language pass over the FULL chain must try ALL keys in ko before
    // EVER attempting English fallback. So ko's later key wins over en's earlier
    // key. A per-key fallback (trying en immediately when ko misses) would
    // wrongly return 'EN'.
    const synthetic = {
      en: { 'skin.line': 'EN' },
      ko: { 'woodak.line': 'KO' },
    };
    expect(resolve(synthetic, 'ko', ['skin.line', 'woodak.line'])).toBe('KO');
  });
});

describe('voiceChain — skin-aware key routing', () => {
  const ALL = new Set(['DOG', 'GHOST', 'ALIEN', 'TURTLE']);

  it('routes a non-default skin to its own key, then WooDak', () => {
    expect(voiceChain('won', 'woodak', 'dog', ALL)).toEqual(['voice.dog.won', 'voice.woodak.won']);
  });

  it('routes the default skin to a single WooDak key', () => {
    expect(voiceChain('tip.3', 'woodak', 'woodak', ALL)).toEqual(['voice.woodak.tip.3']);
  });

  it('ignores the skin for Piyak, a fixed role', () => {
    expect(voiceChain('enc.shopFirstVisit', 'piyak', 'dog', ALL)).toEqual([
      'voice.piyak.enc.shopFirstVisit',
    ]);
  });

  it('falls back to WooDak when the selected skin is not unlocked', () => {
    expect(voiceChain('won', 'woodak', 'ghost', new Set())).toEqual(['voice.woodak.won']);
  });

  it('falls back to WooDak for an unknown skin id', () => {
    expect(voiceChain('won', 'woodak', 'nope' as never, ALL)).toEqual(['voice.woodak.won']);
  });
});

/** Every line id the code can ask a WooDak-role mascot for. */
const WOODAK_LINES: string[] = [
  'unlocked',
  'won',
  'discovery',
  'tip.reroll',
  'tip.discard',
  'tip.shop',
  'tip.0', 'tip.1', 'tip.2', 'tip.3', 'tip.4',
  ...ENCOUNTERS.filter((e) => e.mascot === 'woodak').map((e) => `enc.${e.id}`),
];

/** Every line id the code can ask Piyak for. */
const PIYAK_LINES: string[] = [
  'enc.shopFirstVisit',
  ...Array.from({ length: 8 }, (_, i) => `welcome.${i}`),
];

const RETIRED = [
  /^woodak\./,
  /^mascot\.welcome\./,
  /^tutorial\..*\.body$/,
  /^gameover\.unlockedLine$/,
];

describe('voice namespace migration', () => {
  it('covers 23 WooDak line ids', () => {
    expect(WOODAK_LINES).toHaveLength(23);
  });

  it('routes every run-end clause through the selected mascot voice', () => {
    const source = readFileSync('src/ui/components/WooDakMascot.tsx', 'utf8');
    expect(source).toContain("t(voicedKeys('unlocked'))");
    expect(source).not.toContain("t('gameover.unlockedLine')");
  });

  it('keeps the unlock recap to one selected-mascot line', () => {
    const source = readFileSync('src/ui/components/WooDakMascot.tsx', 'utf8');
    expect(source).toMatch(/const text = unlocked > 0\s*\? t\(voicedKeys\('unlocked'\)\)/);
  });

  it('has every WooDak line in both locales', () => {
    for (const line of WOODAK_LINES) {
      expect(EN[`voice.woodak.${line}`], `en voice.woodak.${line}`).toBeTypeOf('string');
      expect(KO[`voice.woodak.${line}`], `ko voice.woodak.${line}`).toBeTypeOf('string');
    }
  });

  it('has every Piyak line in both locales', () => {
    for (const line of PIYAK_LINES) {
      expect(EN[`voice.piyak.${line}`], `en voice.piyak.${line}`).toBeTypeOf('string');
      expect(KO[`voice.piyak.${line}`], `ko voice.piyak.${line}`).toBeTypeOf('string');
    }
  });

  it('leaves no retired keys behind', () => {
    for (const [name, dict] of [['en', EN], ['ko', KO]] as const) {
      const stale = Object.keys(dict).filter((k) => RETIRED.some((re) => re.test(k)));
      expect(stale, `${name} still has retired keys`).toEqual([]);
    }
  });

  it('has no orphan voice keys — every one is a line the code can request', () => {
    for (const [name, dict] of [['en', EN], ['ko', KO]] as const) {
      const orphans = Object.keys(dict)
        .filter((k) => k.startsWith('voice.'))
        .filter((k) => {
          const rest = k.slice('voice.'.length);
          const skin = rest.slice(0, rest.indexOf('.'));
          const line = rest.slice(rest.indexOf('.') + 1);
          return skin === 'piyak' ? !PIYAK_LINES.includes(line) : !WOODAK_LINES.includes(line);
        });
      expect(orphans, `${name} has orphan voice keys`).toEqual([]);
    }
  });

  it('keeps encounter titles out of the voice namespace', () => {
    for (const e of ENCOUNTERS) {
      expect(EN[`tutorial.${e.id}.title`], `en title ${e.id}`).toBeTypeOf('string');
      expect(KO[`tutorial.${e.id}.title`], `ko title ${e.id}`).toBeTypeOf('string');
    }
  });
});

describe('mascot display names', () => {
  const NAMES: Record<string, { en: string; ko: string }> = {
    'mascot.woodak': { en: 'WooDak', ko: '우땅' },
    'mascot.dog': { en: 'Nurungi', ko: '누렁이' },
    'mascot.ghost': { en: 'Egoya', ko: '이고야' },
    'mascot.alien': { en: 'Egoji', ko: '이고지' },
    'mascot.turtle': { en: 'Nemubo', ko: '느무보' },
  };

  it('names every skin in both locales', () => {
    for (const [key, want] of Object.entries(NAMES)) {
      expect(EN[key], `en ${key}`).toBe(want.en);
      expect(KO[key], `ko ${key}`).toBe(want.ko);
    }
  });

  it('has a name key for every registered skin', () => {
    for (const s of WOODAK_SKINS) {
      expect(Object.keys(NAMES), `skin ${s.id}`).toContain(s.nameKey);
    }
  });
});

describe('Emoji Tile terminology', () => {
  /** Keys whose VALUE must no longer say joker/조커. Key NAMES keep the word —
   *  they are identifiers, not display text (CLAUDE.md terminology rule). */
  const DISPLAY_KEYS = [
    'collection.cat.jokers',
    'shop.yourJokers',
    'shop.noJokers',
    'pack.jokersFull',
    'tutorial.firstJoker.title',
    'voice.woodak.enc.firstJoker',
    'voice.woodak.tip.reroll',
    'voice.piyak.enc.shopFirstVisit',
    'voice.piyak.welcome.3',
  ];

  it('says emoji tile, never joker, in every rewritten string', () => {
    for (const key of DISPLAY_KEYS) {
      expect(EN[key], `en ${key} exists`).toBeTypeOf('string');
      expect(KO[key], `ko ${key} exists`).toBeTypeOf('string');
      expect(EN[key]!.toLowerCase(), `en ${key}`).not.toContain('joker');
      expect(KO[key], `ko ${key}`).not.toContain('조커');
    }
  });

  it('keeps the pack type name unchanged (it never showed "joker")', () => {
    expect(EN['pack.type.joker']).toBe('Charm Pack');
    expect(KO['pack.type.joker']).toBe('부적 팩');
  });
});

/** Skins whose full line set has been written. Each voice task appends its id. */
const VOICED_SKINS: string[] = ['dog', 'ghost', 'alien', 'turtle'];

describe('skin voice completeness', () => {
  it.each(VOICED_SKINS)('%s has all 23 lines in both locales', (skin) => {
    for (const line of WOODAK_LINES) {
      expect(EN[`voice.${skin}.${line}`], `en voice.${skin}.${line}`).toBeTypeOf('string');
      expect(KO[`voice.${skin}.${line}`], `ko voice.${skin}.${line}`).toBeTypeOf('string');
    }
  });

  it.each(VOICED_SKINS)('%s writes its own copy, never WooDak\'s verbatim', (skin) => {
    for (const line of WOODAK_LINES) {
      expect(EN[`voice.${skin}.${line}`], `en ${skin} ${line}`).not.toBe(EN[`voice.woodak.${line}`]);
      expect(KO[`voice.${skin}.${line}`], `ko ${skin} ${line}`).not.toBe(KO[`voice.woodak.${line}`]);
    }
  });

  it.each(VOICED_SKINS)('%s keeps the richtext markers of the WooDak original', (skin) => {
    const markers = (s: string) => (s.match(/\[[a-z]:/g) ?? []).sort();
    for (const line of WOODAK_LINES) {
      for (const [name, dict] of [['en', EN], ['ko', KO]] as const) {
        expect(markers(dict[`voice.${skin}.${line}`]!), `${name} ${skin} ${line}`).toEqual(
          markers(dict[`voice.woodak.${line}`]!),
        );
      }
    }
  });
});

describe('이고지 (alien) speech', () => {
  it('keeps one constructed lexicon instead of replacing it with natural dialogue', () => {
    const romanLocales = ['en', 'pt-BR', 'de', 'es-ES', 'fr-FR', 'pl-PL', 'tr-TR'];
    for (const line of WOODAK_LINES) {
      const english = EN[`voice.alien.${line}`]!;
      expect(english.match(/[A-Za-z]+'[A-Za-z]+/g)?.length).toBeGreaterThanOrEqual(2);
      for (const locale of romanLocales) {
        expect(LOCALES[locale]![`voice.alien.${line}`], `${locale} alien ${line}`).toBe(english);
      }
    }
  });

  it('transliterates that lexicon by locale while preserving markup', () => {
    const markers = (copy: string) => [...copy.matchAll(/\[([a-z]):/g)].map((match) => match[1]);
    const placeholders = (copy: string) => copy.match(/\{[a-z]+\}/gi) ?? [];
    const scripts: Record<string, RegExp> = {
      ko: /[가-힣]/,
      ja: /[ァ-ヶ]/,
      'zh-CN': /[\u4e00-\u9fff]/,
      'zh-TW': /[\u4e00-\u9fff]/,
      'ru-RU': /[\u0400-\u04ff]/,
    };
    for (const line of WOODAK_LINES) {
      const english = EN[`voice.alien.${line}`]!;
      for (const [locale, script] of Object.entries(scripts)) {
        const dict = LOCALES[locale]!;
        const copy = dict[`voice.alien.${line}`]!;
        expect(copy, `${locale} alien ${line}`).toMatch(script);
        expect(copy, `${locale} alien ${line}`).not.toBe(english);
        expect(markers(copy), `${locale} markers ${line}`).toEqual(markers(english));
        expect(placeholders(copy), `${locale} placeholders ${line}`).toEqual(placeholders(english));
      }
    }
  });

  it('keeps the complete localized line set in every locale', () => {
    for (const [locale, dict] of Object.entries(LOCALES)) {
      expect(
        WOODAK_LINES.filter((line) => dict[`voice.alien.${line}`]),
        `${locale} Egoji line count`,
      ).toHaveLength(23);
    }
  });
});

describe('voice coverage guard', () => {
  it('every registered non-default skin has a written voice', () => {
    const need = WOODAK_SKINS.filter((s) => s.id !== 'woodak').map((s) => s.id);
    expect([...need].sort()).toEqual([...VOICED_SKINS].sort());
  });
});
