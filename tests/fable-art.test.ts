import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FABLE_IDS } from '../src/engine/fables';
import { FABLE_ART } from '../src/ui/fableArt';
import { CardArt } from '../src/ui/components/CardArt';

describe('Fable card art', () => {
  it('maps all 18 cards to normalized path-only SVG assets', () => {
    expect(Object.keys(FABLE_ART)).toEqual([...FABLE_IDS]);
    for (let number = 1; number <= FABLE_IDS.length; number += 1) {
      const source = fileURLToPath(
        new URL(`../docs/Arts/Cards/Fable/Vector/T_Fable${number}.svg`, import.meta.url),
      );
      expect(existsSync(source)).toBe(true);
      const svg = readFileSync(source, 'utf8');
      expect(svg).toContain('width="500" height="700"');
      expect(svg).toContain('viewBox="0 0 250 350"');
      expect(svg).toContain('stretch fit');
      expect(svg).toContain('<path ');
      expect(svg).not.toMatch(/<image|data:image|\.png/);
      expect(FABLE_ART[`fable${number}` as keyof typeof FABLE_ART]).toBeTruthy();
    }
  });

  it('renders every illustration through the same 5:7 SVG card geometry', () => {
    for (const id of FABLE_IDS) {
      const markup = renderToStaticMarkup(createElement(CardArt, { family: 'fable', id }));
      expect(markup).toContain('<svg');
      expect(markup).toContain('viewBox="0 0 500 700"');
      expect(markup).toContain('<image');
      expect(markup).toContain('preserveAspectRatio="xMidYMid meet"');
    }
  });

  it('keeps the traced source title without adding a title overlay', () => {
    const markup = renderToStaticMarkup(createElement(CardArt, {
      family: 'fable' as const,
      id: 'fable10',
      title: 'The Town Mouse and the Country Mouse',
    }));

    expect(markup).not.toContain('fable-title-overlay');
    expect(markup).not.toContain('<text');
    expect(markup).not.toContain('<tspan');
    expect(markup).toContain('aria-label="The Town Mouse and the Country Mouse"');
  });
});
