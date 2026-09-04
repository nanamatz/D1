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
    expect(css).toMatch(/\.owned-object-select\s*\{[^}]*inset: 0 0 -12px/s);
  });

  it('keeps actions inside the same TiltCard interaction object', () => {
    expect(shelf).toContain("jokerMenuOpen && 'menu-open'");
    expect(shelf).toMatch(
      /className=\{className\}[\s\S]*className="owned-object-select"[\s\S]*className="consumable-menu bare"[\s\S]*<\/TiltCard>/,
    );
    expect(shelf).toMatch(
      /className="consumable-object"[\s\S]*className="consumable-menu bare"[\s\S]*<\/TiltCard>[\s\S]*className="owned-object-select consumable-select"/,
    );
    expect(css).not.toMatch(
      /\.consumable-slot\.menu-open > \.tt-anchor > \.consumable-select\s*\{[^}]*pointer-events:\s*none;/s,
    );
    expect(css).toContain('.consumables .consumable-slot.menu-open');
    expect(css).toContain('.consumable-slot.menu-open .consumable-object-art');
    expect(css).toContain('.consumable-object > .consumable-menu.bare');
    expect(css).toMatch(
      /\.consumable-object:hover \.consumable-object-art,\s*\.consumable-object:focus-visible \.consumable-object-art\s*\{\s*filter: brightness\(1\.08\);\s*\}/,
    );
    expect(css).toMatch(
      /\.jokers \.joker-slot\.menu-open,\s*\.consumables \.consumable-slot\.menu-open\s*\{[^}]*z-index: 24;[^}]*translate: 0 -5px/s,
    );
    expect(css).toMatch(
      /\.consumable-object > \.consumable-menu\.bare button\.sell \{[^}]*left: calc\(100% \+ var\(--menu-offset\)\)/s,
    );
    expect(css).toMatch(
      /\.consumable-object > \.consumable-menu\.bare button\.use \{[^}]*top: calc\(100% \+ 8px\)/s,
    );
    expect(css).toMatch(
      /\.joker > \.consumable-menu\.bare \{[^}]*top: 50%;[^}]*transform: translateY\(-50%\)/s,
    );
    expect(css).toMatch(
      /\.shop-offer-action \.btn,\s*\.consumable-menu\.bare button\s*\{[^}]*min-width: 82px/s,
    );
  });

  it('toggles owned objects and keeps Emoji selection attached to physical identity', () => {
    expect(shelf).toContain('const jokerKey = owned.instanceId ?? owned');
    expect(shelf).toContain('const jokerMenuOpen = jokerMenuKey === jokerKey');
    expect(shelf).toContain('aria-expanded={jokerMenuOpen}');
    expect(shelf).toContain('setJokerMenuKey(jokerMenuOpen ? null : jokerKey)');
    expect(shelf).toMatch(
      /onKeyDown=\{\(e\) => \{\s*if \(e\.key !== 'Escape' \|\| !jokerMenuOpen\) return;\s*e\.stopPropagation\(\);\s*setJokerMenuKey\(null\);/,
    );
    expect(shelf).toContain('aria-expanded={menuIdx === i}');
    expect(shelf).toContain('setMenuIdx(menuIdx === i ? null : i)');
    expect(shelf).toMatch(
      /className="owned-object-select consumable-select"[\s\S]*?if \(e\.key !== 'Escape'\) return;\s*e\.stopPropagation\(\);\s*setMenuIdx\(null\);/,
    );
  });

  it('retains toggles and locks on the other reversible object surfaces', () => {
    const shop = source('../src/ui/components/Shop.tsx');
    const pack = source('../src/ui/components/PackOpening.tsx');
    const game = source('../src/ui/useGame.ts');
    const gameUi = source('../src/ui/game.ts');
    const bag = source('../src/ui/components/BagView.tsx');

    expect(shop).toContain('setSelectedOffer((current) => current === key ? null : key)');
    expect(shop.match(/onSelect=\{\(\) => toggleOffer\(offerKey\)\}/g)).toHaveLength(3);
    expect(pack).toContain('if (interactionLocked) return;');
    expect(pack).toContain('setSelectedFable(selected ? null : key)');
    expect(pack).toContain('if (selectedCandidates.includes(tileId))');
    expect(pack).toContain('onSelectedCandidatesChange(selectedCandidates.filter((id) => id !== tileId))');
    expect(pack).toContain('} else if (selectedCandidates.length < candidateMax) {');
    expect(game).toContain('if (id === prev.blind.forcedTileId && prev.selected.includes(id)) return prev;');
    expect(game).toContain('? prev.selected.filter((x) => x !== id)');
    expect(gameUi).toContain('if (marks.includes(id)) return single ? [] : marks.filter((mark) => mark !== id);');
    expect(bag).toContain('onClick={() => setOpen((value) => !value)}');
    expect(bag).toContain("if (event.key === 'Escape') setOpen(false)");
  });
});
