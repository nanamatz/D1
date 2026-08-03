import { describe, it, expect } from 'vitest';
import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { BALANCE } from '../src/engine/balance';
import { packTooltip } from '../src/ui/packTooltip';
import { richText, stripRichText } from '../src/ui/richtext';
import type { PackSize, PackType } from '../src/engine/types';

const TYPES: readonly PackType[] = ['pattern', 'joker', 'consumable', 'tile', 'ink'];
const SIZES: readonly PackSize[] = ['normal', 'jumbo', 'mega'];
const LOCALES = { en: en as Record<string, string>, ko: ko as Record<string, string> };

/** Same interpolation the real i18n does (i18n.tsx), so the copy is exercised for real. */
const makeT =
  (dict: Record<string, string>) =>
  (key: string, params?: Record<string, string | number>): string => {
    let s = dict[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };

describe('packTooltip — size-aware pack copy', () => {
  it('body carries the show/pick counts for every type × size, in both locales', () => {
    for (const [name, dict] of Object.entries(LOCALES)) {
      const t = makeT(dict);
      for (const type of TYPES) {
        for (const size of SIZES) {
          const { show, pick } = BALANCE.pack.size[size];
          const { body } = packTooltip(type, size, t);
          expect(body, `${name}/${type}/${size} show`).toContain(`[n:${show}]`);
          expect(body, `${name}/${type}/${size} pick`).toContain(`[n:${pick}]`);
          // no leftover placeholder survived interpolation
          expect(body, `${name}/${type}/${size} placeholders`).not.toMatch(/\{(show|pick)\}/);
        }
      }
    }
  });

  it('Mega packs say pick 2 — the bug the old type-keyed copy had', () => {
    const t = makeT(LOCALES.ko);
    // The old copy was a flat "조커 1개 선택" regardless of size.
    for (const type of TYPES) {
      expect(BALANCE.pack.size.mega.pick).toBe(2);
      expect(packTooltip(type, 'mega', t).body).toContain('[n:2]');
      expect(packTooltip(type, 'normal', t).body).toContain('[n:1]');
    }
  });

  it('title is the pack type alone; the size rides on the grade badge', () => {
    const t = makeT(LOCALES.ko);
    for (const type of TYPES) {
      for (const size of SIZES) {
        const { title, grade } = packTooltip(type, size, t);
        expect(title).toBe(LOCALES.ko[`pack.type.${type}`]);
        expect(title).not.toContain('·'); // the old "type · size" cram is gone
        expect(grade).toBe(size);
      }
    }
  });

  it('every locale defines all five pack descriptions with matching markup', () => {
    for (const [name, dict] of Object.entries(LOCALES)) {
      for (const type of TYPES) {
        const raw = dict[`packdesc.${type}`];
        expect(raw, `${name}/${type} exists`).toBeDefined();
        // exactly two counts (show + pick) and one card-kind noun
        expect(raw!.match(/\[n:/g) ?? [], `${name}/${type} counts`).toHaveLength(2);
        expect(raw!.match(/\[k:/g) ?? [], `${name}/${type} kind`).toHaveLength(1);
        // tags are balanced — every opener has a closing bracket
        expect((raw!.match(/\[/g) ?? []).length).toBe((raw!.match(/\]/g) ?? []).length);
      }
    }
  });
});

describe('richText — pack highlight tags', () => {
  it('renders [n:] as a count and [k:] as a card-kind', () => {
    const classes = richText('최대 [n:5]장의 [k:구두점] 카드 중 [n:2]장')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual(['hl-count', 'hl-kind', 'hl-count']);
  });

  it('still renders the pre-existing mult/chips/blind tags', () => {
    const classes = richText('[m:×3] [c:+50] [b:Blind]')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual(['hl-mult', 'hl-chips', 'hl-blind']);
  });

  it('boxes only multiplication numbers and leaves additive values and units colour-only', () => {
    const markup = renderToStaticMarkup(createElement(
      'span',
      null,
      richText('[m:+4 Mult] [c:+30 Chips] [m:×1.5 Mult] [c:×3 칩]'),
    ));
    expect(markup).toContain('<span class="hl-mult"><span class="hl-value">+4</span> Mult</span>');
    expect(markup).toContain('<span class="hl-chips"><span class="hl-value">+30</span> Chips</span>');
    expect(markup).toContain('<span class="hl-mult"><span class="hl-factor">×1.5</span> Mult</span>');
    expect(markup).toContain('<span class="hl-chips"><span class="hl-factor">×3</span> 칩</span>');
  });

  it('highlights only the numeric part of a tile Chips contribution', () => {
    const koText = makeT(LOCALES.ko)('tile.chips', { n: 9 });
    const enText = makeT(LOCALES.en)('tile.chips', { n: 9 });
    const markup = renderToStaticMarkup(createElement('span', null, richText(koText)));

    expect(koText).toBe('[c:+9 개의 칩]');
    expect(enText).toBe('[c:+9 Chips]');
    expect(markup).toBe(
      '<span><span class="hl-chips"><span class="hl-value">+9</span> 개의 칩</span></span>',
    );
    expect(stripRichText(koText)).toBe('+9 개의 칩');
  });

  it('leaves axis words without a numeric value uncoloured', () => {
    const markup = renderToStaticMarkup(createElement('span', null, richText('[m:Mult] [c:칩]')));
    expect(markup).toBe('<span><span class="hl-mult">Mult</span> <span class="hl-chips">칩</span></span>');
  });

  it('renders money and passive-property tags instead of leaking markup', () => {
    const classes = richText('[$:$5] [p:+1 Emoji Tile slot]')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual(['hl-money', 'hl-property']);
  });

  it('emphasizes the gibberish term', () => {
    const classes = richText('[g:Gibberish]')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual(['hl-gibberish']);
  });

  it('uses the matching Emoji Tile rarity classes', () => {
    const classes = richText('[C:Common] [U:Uncommon] [R:Rare] [L:Legendary]')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual([
      'hl-rarity-common',
      'hl-rarity-uncommon',
      'hl-rarity-rare',
      'hl-rarity-legendary',
    ]);

    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(css).toMatch(/\.hl-rarity-rare\s*\{[^}]*color:\s*var\(--rarity-rare\)/s);
    expect(css).toMatch(/\.tt-rarity\.rare\s*\{[^}]*background:\s*var\(--rarity-rare\)/s);
  });

  it('uses the matching edition classes', () => {
    const classes = richText('[G:Gray] [v:Violet] [r:Rainbow] [w:White]')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual([
      'hl-edition-gray',
      'hl-edition-violet',
      'hl-edition-rainbow',
      'hl-edition-white',
    ]);

    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(css).toMatch(/\.hl-edition-gray\s*\{[^}]*color:\s*#718185/s);
    expect(css).toMatch(/\.hl-edition-violet\s*\{[^}]*color:\s*#875b91/s);
    expect(css).toMatch(/\.hl-edition-rainbow\s*\{[^}]*background:\s*linear-gradient/s);
    expect(css).toMatch(
      /\.hl-edition-white\s*\{[^}]*color:\s*#fff[^}]*-webkit-text-stroke:\s*2px #27313a/s,
    );
  });

  it('leaves untagged prose untouched', () => {
    expect(richText('plain copy')).toEqual(['plain copy']);
  });

  it('keeps every highlighted tooltip phrase on one line as an atomic unit', () => {
    const css = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(css).toMatch(/\.tt-body \[class\^='hl-'\][^{]*\{[^}]*white-space:\s*nowrap/s);
  });
});

describe('effect-description markup', () => {
  it('marks every edition mention without treating property names as editions', () => {
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(dict)) {
        if (!/desc/i.test(key)) continue;
        const plain = value
          .replace(/\[[Gvrw]:[^\]]*]/g, '')
          .replace(/\[p:[^\]]*]/g, '');
        expect(plain, `${lang}/${key}`).not.toMatch(
          /\b(?:Gray|Violet|Rainbow|White)\b|그레이|바이올렛|레인보우|화이트/i,
        );
      }
    }
  });

  it('marks every Emoji Tile rarity mention in both locales', () => {
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(dict)) {
        if (!/desc/i.test(key)) continue;
        const plain = value.replace(/\[[CURL]:[^\]]*]/g, '');
        expect(plain, `${lang}/${key}`).not.toMatch(
          /(?:Common|Uncommon|Rare|Legendary) Emoji Tile|(?:일반|고급|희귀|전설) 이모지 타일/i,
        );
      }
    }
  });

  it('marks every displayed money amount in both locales', () => {
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(dict)) {
        if (!/desc/i.test(key) && key !== 'consumable.currentSellValue') continue;
        expect(value.replace(/\[\$:[^\]]*]/g, ''), `${lang}/${key}`).not.toContain('$');
      }
    }
  });

  it('marks every Gibberish mention and routes it to the shared definition tooltip', () => {
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(dict)) {
        if (!/desc/i.test(key)) continue;
        expect(
          value.replace(/\[g:[^\]]*]/g, ''),
          `${lang}/${key}`,
        ).not.toMatch(/횡설수설|gibberish/i);
      }
      expect(dict['tooltip.gibberish.title']).toBeDefined();
      expect(dict['tooltip.gibberish.body']).toBeDefined();
    }

    const tooltip = readFileSync('src/ui/components/Tooltip.tsx', 'utf8');
    const tile = readFileSync('src/ui/components/Tile.tsx', 'utf8');
    expect(tooltip).toContain("body.includes('[g:')");
    expect(tooltip).toContain("t('tooltip.gibberish.body')");
    expect(tile).toContain('<Tooltip');
    expect(tile).toContain('compact');
  });
});
