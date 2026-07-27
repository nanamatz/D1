import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GAMBLER_CARDS } from '../src/ui/gamblerArt';
import { FamilyCardArt } from '../src/ui/components/FamilyCardArt';

describe('Gambler card artwork registry', () => {
  it('registers the 14 supplied cards exactly once as Fable-sized path-only SVGs', () => {
    expect(GAMBLER_CARDS).toHaveLength(14);
    expect(new Set(GAMBLER_CARDS.map((card) => card.id)).size).toBe(14);
    expect(GAMBLER_CARDS.every((card) => card.art.endsWith('.svg'))).toBe(true);

    const filenames = [
      'BarnSwallow', 'Boar', 'Bridge', 'BushWarbler', 'Butterflies',
      'CraneAndSun', 'Cuckoo', 'Curtain', 'Deer', 'FullMoon', 'Geese',
      'Phoenix', 'Rainman', 'SakeCup',
    ];
    for (const filename of filenames) {
      const source = fileURLToPath(
        new URL(`../docs/Arts/Cards/Gambler/Vector/${filename}.svg`, import.meta.url),
      );
      expect(existsSync(source)).toBe(true);
      const svg = readFileSync(source, 'utf8');
      expect(svg).toContain('width="500" height="700"');
      expect(svg).toContain('viewBox="0 0 250 350"');
      expect(svg).toContain('stretch fit');
      expect(svg).toContain('<path ');
      expect(svg).not.toMatch(/<image|data:image|\.png/);
    }
  });

  it('remains presentation-only while effects are pending', () => {
    expect(GAMBLER_CARDS.every((card) => !('effect' in card))).toBe(true);
  });

  it('uses the shared 5:7 SVG card geometry', () => {
    const card = GAMBLER_CARDS[0]!;
    const markup = renderToStaticMarkup(createElement(FamilyCardArt, {
      src: card.art,
      title: card.nameEn,
    }));
    expect(markup).toContain('viewBox="0 0 500 700"');
    expect(markup).toContain('family-card-svg-art');
    expect(markup).toContain('aria-label="Barn Swallow"');
  });
});
