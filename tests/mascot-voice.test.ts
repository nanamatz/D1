import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { resolve } from '../src/ui/i18n';
import { voiceChain, WOODAK_SKINS } from '../src/ui/mascots';
import { ENCOUNTERS } from '../src/ui/tutorial';

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
        if (skin === 'alien') continue; // alien relabels markers in its own tongue
        expect(markers(dict[`voice.${skin}.${line}`]!), `${name} ${skin} ${line}`).toEqual(
          markers(dict[`voice.woodak.${line}`]!),
        );
      }
    }
  });
});

/**
 * 이고지's fixed vocabulary. Every token in every `voice.alien.*` string must appear
 * here — that constraint is what makes the speech read as a real language rather
 * than noise, and it is the reason a new line cannot be improvised. If a line needs
 * a concept with no token, prefer rephrasing with existing vocabulary; add a row
 * only for a genuinely new concept, and record it in the design spec too.
 */
const ALIEN_LEXICON: Record<string, string> = {
  "an'ka": 'new', ao: 'vowel', "ar'ti": 'article/adjective', blin: 'blind',
  "bou'nak": 'pouch', "chap'ta": 'chapter', chi: 'chips', "del'vo": 'discard',
  "do'gan": 'collection/book', "em'ji": 'emoji', "fa'zen": 'phase', "flu'sha": 'flush',
  "fon'ta": 'font', "glo'ba": 'gibberish', "gru'vak": 'big', "hol'na": 'hole',
  "il'ma": 'see/look', "ka'lith": 'hand', "ka'shen": 'same', "kel'dan": 'money',
  "kon'su": 'consumable', "kre'sha": 'grow', "ku'ren": 'fire/trigger', "lo'ren": 'late',
  "ma'run": 'material', "mi'ren": 'you', "mor'ka": 'shop',
  mul: 'multiplier', "nak'ta": 'draw', "ne'sha": 'rule', nu: 'not',
  "nu'kha": 'none/did not', "nu'ven": 'few/small', "ol'dan": 'order', ollu: 'all',
  "pa'tarn": 'pattern', "pen'ta": 'five', "qa'shi": 'score',
  "re'rol": 'reroll', reth: 'remain/keep', "se'la": 'seal', "sen'tal": 'sentence',
  shen: 'suit/color', "shi'mela": 'good', "ta'wen": 'two', thal: 'end',
  tolun: 'word', "tor'un": 'tile', "tri'un": 'three', "u'nizn": 'unison',
  unn: 'one', vai: 'void', "vau'cha": 'voucher', vell: 'when/if',
  "vok'tu": 'change', vor: 'and/then', "vor'nak": 'achieved', "zar'ka": 'boss',
  "zin'ka": 'twin', "zk'tha": 'joy', "zor'ga": 'hard/stiff',
};

/** One fixed Korean orthography for the same alien tokens; do not improvise spellings. */
const KO_ALIEN_LEXICON: Record<string, string> = {
  "an'ka": "안'카", ao: '아오', "ar'ti": "아르'티", blin: '블린',
  "bou'nak": "부'낙", "chap'ta": "챕'타", chi: '치', "del'vo": "델'보",
  "do'gan": "도'간", "em'ji": "엠'지", "fa'zen": "파'젠", "flu'sha": "플루'샤",
  "fon'ta": "폰'타", "glo'ba": "글로'바", "gru'vak": "그루'바크", "hol'na": "홀'나",
  "il'ma": "일'마", "ka'lith": "카'리스", "ka'shen": "카'셨", "kel'dan": "켈'단",
  "kon'su": "콘'수", "kre'sha": "크레'샤", "ku'ren": "쿠'렌", "lo'ren": "로'렌",
  "ma'run": "마'룬", "mi'ren": "미'렌", "mor'ka": "모르'카",
  mul: '물', "nak'ta": "낙'타", "ne'sha": "네'샤", nu: '누',
  "nu'kha": "누'카", "nu'ven": "누'벤", "ol'dan": "올'단", ollu: '올루',
  "pa'tarn": "파'타른", "pen'ta": "펜'타", "qa'shi": "카'시",
  "re'rol": "레'롤", reth: '레스', "se'la": "세'라", "sen'tal": "센'탈",
  shen: '셨', "shi'mela": "시'멜라", "ta'wen": "타'웬", thal: '탈',
  tolun: '톨룬', "tor'un": "토르'운", "tri'un": "트리'운", "u'nizn": "우'니즌",
  unn: '운', vai: '바이', "vau'cha": "바우'차", vell: '벨',
  "vok'tu": "보크'투", vor: '보르', "vor'nak": "보르'낙", "zar'ka": "자르'카",
  "zin'ka": "진'카", "zk'tha": "즈크'타", "zor'ga": "조르'가",
};

/** Strip richtext markup, params and punctuation; return lowercase word tokens.
 *  Order matters: `{n}` and `[c:` must go before the generic punctuation strip, and
 *  the apostrophe is deliberately NOT stripped — it is part of every alien token. */
function alienTokens(s: string): string[] {
  return s
    .replace(/\{n\}/g, ' ')
    .replace(/\[[a-z]:/g, ' ')
    .replace(/[.,!?:;=\]—…"×$0-9]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

describe('이고지 (alien) speech', () => {
  it('uses a distinct Hangul alien rendering for every Korean line', () => {
    for (const line of WOODAK_LINES) {
      const english = EN[`voice.alien.${line}`]!;
      const korean = KO[`voice.alien.${line}`]!;
      expect(korean, `alien ${line}`).not.toBe(english);
      const visible = korean
        .replace(/\[[a-z]:/g, '[')
        .replace(/\{[a-z]+\}/gi, '');
      expect(visible, `ko alien ${line}`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('preserves marker kinds and placeholders across languages', () => {
    const markers = (copy: string) => [...copy.matchAll(/\[([a-z]):/g)].map((match) => match[1]);
    const placeholders = (copy: string) => copy.match(/\{[a-z]+\}/gi) ?? [];
    for (const line of WOODAK_LINES) {
      const english = EN[`voice.alien.${line}`]!;
      const korean = KO[`voice.alien.${line}`]!;
      expect(markers(korean), `markers ${line}`).toEqual(markers(english));
      expect(placeholders(korean), `placeholders ${line}`).toEqual(placeholders(english));
    }
  });

  it('uses the fixed Korean orthography for the approved English lexicon', () => {
    expect(Object.keys(KO_ALIEN_LEXICON).sort()).toEqual(Object.keys(ALIEN_LEXICON).sort());
    for (const line of WOODAK_LINES) {
      const englishTokens = alienTokens(EN[`voice.alien.${line}`]!);
      expect(alienTokens(KO[`voice.alien.${line}`]!), `ko alien ${line}`).toEqual(
        englishTokens.map((token) => KO_ALIEN_LEXICON[token]),
      );
    }
  });

  it('uses only approved lexicon tokens', () => {
    const unknown = new Set<string>();
    for (const line of WOODAK_LINES) {
      for (const tok of alienTokens(EN[`voice.alien.${line}`]!)) {
        if (!(tok in ALIEN_LEXICON)) unknown.add(`${tok} (in ${line})`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('exercises most of the lexicon — an unused token is dead vocabulary', () => {
    const used = new Set(WOODAK_LINES.flatMap((l) => alienTokens(EN[`voice.alien.${l}`]!)));
    const unused = Object.keys(ALIEN_LEXICON).filter((k) => !used.has(k));
    expect(unused, `unused lexicon entries: ${unused.join(', ')}`).toEqual([]);
  });
});

describe('voice coverage guard', () => {
  it('every registered non-default skin has a written voice', () => {
    const need = WOODAK_SKINS.filter((s) => s.id !== 'woodak').map((s) => s.id);
    expect([...need].sort()).toEqual([...VOICED_SKINS].sort());
  });
});
