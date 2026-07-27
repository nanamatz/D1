import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('held consumable foreground objects', () => {
  const shelf = source('../src/ui/components/JokerShelf.tsx');
  const css = source('../src/ui/styles/play.css');

  it('renders supplied art directly without the legacy card/name wrapper', () => {
    expect(shelf).toContain('className="consumable-object"');
    expect(shelf).toContain('className="consumable-object-art"');
    expect(shelf).not.toContain('className="consumable use"');
    expect(shelf).not.toContain('<span className="n">{t(`consumable.${c}`)}</span>');
  });

  it('keeps the reserved slot transparent and the foreground unclipped', () => {
    expect(css).toContain('.consumable-object {');
    expect(css).toContain('background: transparent');
    expect(css).toContain('.consumable-object-art {');
    expect(css).toContain('overflow: visible');
  });

  it('raises selection and attaches actions beneath the image', () => {
    expect(css).toContain('.consumable-slot.menu-open');
    expect(css).toContain('.consumable-slot.menu-open .consumable-object-art');
    expect(css).toContain('.consumable-slot > .consumable-menu.bare');
    expect(css).toContain('top: calc(100% + 8px)');
  });
});
