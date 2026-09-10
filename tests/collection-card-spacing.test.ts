import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Collection consumable-card spacing', () => {
  it('evenly distributes incomplete Constellation and Gambler pages', () => {
    const component = readFileSync('src/ui/components/Collection.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/screens.css', 'utf8');

    expect(component).toContain("visible.length < CARDS_PER_PAGE && 'card-family-partial'");
    expect(css).toMatch(/\.card-family-partial\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-evenly/s);
    expect(css).toMatch(/\.card-family-partial > \.tt-anchor\s*\{[^}]*width:\s*min\(160px,/s);
  });
});
