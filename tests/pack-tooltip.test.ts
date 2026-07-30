import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { BALANCE } from '../src/engine/balance';
import { packTooltip, type PackTooltipType } from '../src/ui/packTooltip';
import { richText } from '../src/ui/richtext';
import type { PackSize } from '../src/engine/types';

const TYPES: readonly PackTooltipType[] = ['pattern', 'joker', 'consumable', 'tile', 'ink'];
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

  it('renders money and passive-property tags instead of leaking markup', () => {
    const classes = richText('[$:$5] [p:+1 Emoji Tile slot]')
      .filter(isValidElement)
      .map((node) => (node.props as { className: string }).className);
    expect(classes).toEqual(['hl-money', 'hl-property']);
  });

  it('leaves untagged prose untouched', () => {
    expect(richText('plain copy')).toEqual(['plain copy']);
  });
});
