import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind } from '../src/engine/loop';
import { judgeSentence } from '../src/engine/patterns';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { POS, WordSubmission } from '../src/engine/types';
import { I18nProvider } from '../src/ui/i18n';
import { PosTags } from '../src/ui/components/PosTags';
import { SentenceTray } from '../src/ui/components/SentenceTray';

describe('POS tag chips', () => {
  it('renders localized candidates as separate accessible chips', () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <PosTags
          candidates={['noun', 'verbIntransitive', 'verbTransitive']}
          active={['verbIntransitive']}
        />
      </I18nProvider>,
    );

    expect(html).toContain('class="pos-tag pos-noun alternative"');
    expect(html).toContain('class="pos-tag pos-verbIntransitive active"');
    expect(html).toContain('class="pos-tag pos-verbTransitive alternative"');
    expect(html.match(/role="listitem"/g)).toHaveLength(3);
    expect(html).not.toContain('pos-marker');
    expect(html).toContain('aria-label="noun, alternative candidate"');
    expect(html).toContain('aria-label="verb · intrans, compatible with pattern"');
    expect(html).not.toContain(' / ');
  });

  it('keeps all candidates equal when no pattern has resolved them', () => {
    const html = renderToStaticMarkup(
      <I18nProvider>
        <PosTags candidates={['adjective', 'adverb', 'article']} />
      </I18nProvider>,
    );

    expect(html).toContain('class="pos-tags unresolved"');
    expect(html).not.toContain('aria-label=');
    expect(html).not.toContain(' active"');
    expect(html).not.toContain(' alternative"');
  });

  it('keeps resolved states distinct without color or layout shifts', () => {
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(css).toMatch(/\.pos-tag\s*\{[^}]*border:\s*2px solid/s);
    expect(css).toMatch(/\.pos-tag\s*\{[^}]*border-radius:\s*2px/s);
    expect(css).not.toContain('.pos-marker');
    expect(css).toMatch(/\.pos-tag\.active\s*\{[^}]*border-style:\s*solid[^}]*border-color:\s*var\(--ink\)[^}]*background:\s*color-mix\([^;]*var\(--ink\)\)[^}]*color:\s*var\(--tile-ink\)/s);
    expect(css).toMatch(/\.pos-tag\.alternative\s*\{[^}]*border-style:\s*dashed/s);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*\.pos-tag\.active[\s\S]*outline:\s*2px solid Highlight/);
  });

  it('maps every POS identity to its own palette token and final colour', () => {
    const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    const mappings = {
      noun: 'noun',
      verbIntransitive: 'verb-intransitive',
      verbTransitive: 'verb-transitive',
      verbLinking: 'verb-linking',
      adjective: 'adjective',
      adverb: 'adverb',
      article: 'article',
      conjunction: 'conjunction',
      preposition: 'preposition',
      interjection: 'interjection',
    } as const;
    const neutralValues = Object.values(mappings).map((token) => {
      const matches = [...tokens.matchAll(new RegExp(`--pos-${token}:\\s*(#[0-9a-f]{6})`, 'gi'))];
      expect(matches, token).toHaveLength(2);
      return matches[0]![1]!.toLowerCase();
    });
    const unlockedValues = Object.values(mappings).map((token) => {
      const matches = [...tokens.matchAll(new RegExp(`--pos-${token}:\\s*(#[0-9a-f]{6})`, 'gi'))];
      return matches[1]![1]!.toLowerCase();
    });

    expect(new Set(neutralValues).size).toBe(10);
    expect(new Set(unlockedValues).size).toBe(10);
    const groupBits: Record<keyof typeof mappings, number> = {
      noun: 8,
      verbIntransitive: 1,
      verbTransitive: 1,
      verbLinking: 1,
      adjective: 2,
      adverb: 2,
      article: 2,
      conjunction: 4,
      preposition: 4,
      interjection: 8,
    };
    for (let unlockedMask = 0; unlockedMask < 16; unlockedMask += 1) {
      const values = (Object.keys(mappings) as (keyof typeof mappings)[]).map((pos, index) =>
        (unlockedMask & groupBits[pos]) !== 0 ? unlockedValues[index] : neutralValues[index],
      );
      expect(new Set(values).size, `Palette mask ${unlockedMask}`).toBe(10);
    }
    const html = renderToStaticMarkup(
      <I18nProvider><PosTags candidates={Object.keys(mappings) as POS[]} /></I18nProvider>,
    );
    for (const [pos, token] of Object.entries(mappings)) {
      expect(css).toContain(`.pos-tag.pos-${pos} {\n  --pos-tone: var(--pos-${token});`);
      expect((tokens.match(new RegExp(`--pos-${token}:`, 'g')) ?? []).length, token).toBe(2);
      expect(html).toContain(`class="pos-tag pos-${pos}"`);
    }
    for (const lang of ['en', 'ko']) {
      const locale = JSON.parse(readFileSync(`locales/${lang}.json`, 'utf8')) as Record<string, string>;
      const labels = Object.keys(mappings).map((pos) => locale[`pos.${pos}`]);
      expect(labels.every(Boolean), lang).toBe(true);
      expect(new Set(labels).size, lang).toBe(10);
    }
    expect(css).not.toContain('.pos-tag:is(.pos-');
  });

  it('renders nothing for the production-invalid empty candidate boundary', () => {
    expect(renderToStaticMarkup(
      <I18nProvider><PosTags candidates={[]} /></I18nProvider>,
    )).toBe('');
  });

  it('maps winning POS back across boss-transformed and debuffed raw history', () => {
    const entry = (text: string, pos: POS[], debuffed = false): WordSubmission => ({
      tiles: [], text, isGibberish: false, suit: 'standard', posUsed: null,
      settledScore: 0, ...(debuffed ? { debuffed: true } : {}),
    });
    const raw = [
      entry('orphan', ['noun']),
      entry('blocked', ['preposition'], true),
      entry('birds', ['noun', 'adjective']),
      entry('run', ['noun', 'verbIntransitive']),
    ];
    const lexicon = makeLexicon([], Object.fromEntries(raw.map((word) => [
      word.text,
      { suit: 'standard' as const, pos: word.text === 'orphan' ? ['noun']
        : word.text === 'blocked' ? ['preposition']
          : word.text === 'birds' ? ['noun', 'adjective']
            : ['noun', 'verbIntransitive'] },
    ])));
    const run = newRun('pos-raw-history');
    const blind = { ...startBlind(run, makeRng(run.seed)), bossId: 'orphanLine', sequence: raw };
    const judgment = judgeSentence(raw.slice(2), lexicon);
    const html = renderToStaticMarkup(
      <I18nProvider>
        <SentenceTray
          blind={blind}
          judgment={judgment}
          lexicon={lexicon}
          patternLevels={run.patternLevels}
        />
      </I18nProvider>,
    );

    expect(judgment.match?.pattern).toBe('simple');
    expect(html.match(/class="pos-tag pos-noun"/g)).toHaveLength(1);
    expect(html.match(/class="pos-tag pos-noun active"/g)).toHaveLength(1);
    expect(html.match(/class="pos-tag pos-noun alternative"/g)).toHaveLength(1);
    expect(html).toContain('class="pos-tag pos-adjective alternative"');
    expect(html).toContain('class="pos-tag pos-verbIntransitive active"');
    expect(html).not.toContain('pos-preposition');
  });
});
