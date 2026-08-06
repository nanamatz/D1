import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { useGambler } from '../src/engine/gamblers';
import { startBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { buildConsumableEffect } from '../src/ui/consumableEffect';
import { chanceFraction } from '../src/ui/components/ChanceBadges';

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('shared consumable result animation', () => {
  it('reports Full Moon destruction and all three pouch creations', () => {
    const run = { ...newRun('full-moon-fx'), consumables: ['fullMoon' as const] };
    const blind = startBlind(run, makeRng(run.seed));
    const result = useGambler(
      'fullMoon', run, blind, blind.hand.slice(0, 1), [], makeRng('full-moon-fx-use'),
    );
    const effect = buildConsumableEffect('fullMoon', run, result.run);
    expect(effect.removedTiles).toHaveLength(1);
    expect(effect.addedTiles).toHaveLength(3);
  });

  it('reports Sake Cup destruction and the kept Emoji Tile edition change', () => {
    const before = {
      ...newRun('sake-fx'),
      consumables: ['sakeCup' as const],
      jokers: [
        { defId: 'stargazer', edition: 'base' as const, state: {} },
        { defId: 'hypocrite', edition: 'base' as const, state: {} },
      ],
    };
    const blind = startBlind(before, makeRng(before.seed));
    const result = useGambler('sakeCup', before, blind, [], [], makeRng('sake-fx-use'));
    const effect = buildConsumableEffect('sakeCup', before, result.run);
    expect(effect.removedJokers).toHaveLength(2);
    expect(effect.addedJokers).toEqual([
      expect.objectContaining({ edition: 'rainbow' }),
    ]);
  });

  it('renders destroyed, changed, and created outcomes from one shared vignette', () => {
    const component = source('../src/ui/components/ConsumableEffect.tsx');
    const css = source('../src/ui/styles/screens.css');
    expect(component).toContain("tileObject(tile, 'destroyed')");
    expect(component).toContain("tileObject(tile, 'changed')");
    expect(component).toContain("tileObject(tile, 'created')");
    expect(component).toContain('tooltip={tileTooltip(tile, t)}');
    expect(css).toContain('.cfx-destroyed');
    expect(css).toContain('.cfx-created');
  });

  it('emphasizes economy and edition outcomes and shatters removed tiles', () => {
    const component = source('../src/ui/components/ConsumableEffect.tsx');
    const css = source('../src/ui/styles/screens.css');
    expect(component).toContain('className="cfx-shatter-fx"');
    expect(component).toContain('className="cfx-gold"');
    expect(css).toMatch(/\.cfx-stats \.cfx-gold\s*\{[^}]*border:\s*0;[^}]*font-size:\s*var\(--ds-2xl\);/s);
    expect(css).toMatch(/\.consumable-effect \.chance-result\s*\{[^}]*font-size:\s*var\(--ds-sm\);/s);
    expect(css).toContain('@keyframes cfx-shatter-shards');
  });

  it('preserves exact chance outcomes for the shared result vignette', () => {
    const run = newRun('chance-fx');
    const chanceResults = [{
      chance: 0.25,
      label: 'edition' as const,
      outcome: 'failure' as const,
    }];
    expect(buildConsumableEffect('fable15', run, run, chanceResults).chanceResults)
      .toEqual(chanceResults);
    expect(chanceFraction(0.25)).toBe('1/4');
    expect(chanceFraction(0.2)).toBe('1/5');
    expect(chanceFraction(0.01)).toBe('1/100');
    expect(source('../src/ui/components/ConsumableEffect.tsx')).toContain(
      '<ChanceBadges results={active.chanceResults}',
    );
  });

  it('wraps Fable effect copy at word boundaries', () => {
    const styles = source('../src/ui/styles/screens.css');
    expect(styles).toMatch(/\.cfx-copy > p\s*\{[^}]*word-break:\s*keep-all;/s);
    expect(styles).toMatch(/\.cfx-copy > p\s*\{[^}]*overflow-wrap:\s*break-word;/s);
  });

  it('wires held, shop, and non-target pack consumables to the shared effect bus', () => {
    const game = source('../src/ui/useGame.ts');
    expect(game.match(/consumableEffectBus\.emit/g)?.length).toBeGreaterThanOrEqual(5);
    expect(game).toContain('if (!fableTargetsTiles(id)) consumableEffectBus.emit');
    expect(game).toContain("GAMBLER_REGISTRY.get(id)?.effect.kind !== 'font'");
  });

  it('anchors chance results to score tiles and round-end Emoji Tiles without a modal', () => {
    const app = source('../src/ui/App.tsx');
    const tile = source('../src/ui/components/Tile.tsx');
    const jokerShelf = source('../src/ui/components/JokerShelf.tsx');
    const jokerChance = source('../src/ui/components/JokerChanceEffect.tsx');
    const screens = source('../src/ui/styles/screens.css');
    const game = source('../src/ui/useGame.ts');
    expect(app).toContain('<JokerChanceEffect />');
    expect(tile).toContain('<ChanceBadges results={effectPop.chanceResults}');
    expect(jokerShelf).toContain('data-joker-id={owned.defId}');
    expect(jokerChance).toContain("querySelectorAll<HTMLElement>('.joker-slot[data-joker-id]')");
    expect(jokerChance).toContain('className={`trigger-pop joker-chance-pop');
    expect(jokerChance).not.toContain('className="joker-chance-effect"');
    expect(screens).not.toContain('.joker-chance-effect');
    expect(game).toContain('jokerChanceEffectBus.emit(chanceResults)');
  });
});
