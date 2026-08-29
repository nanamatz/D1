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
