import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { useGambler } from '../src/engine/gamblers';
import { startBlind } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { buildConsumableEffect } from '../src/ui/consumableEffect';

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

  it('wires held, shop, and non-target pack consumables to the shared effect bus', () => {
    const game = source('../src/ui/useGame.ts');
    expect(game.match(/consumableEffectBus\.emit/g)?.length).toBeGreaterThanOrEqual(5);
    expect(game).toContain('if (!fableTargetsTiles(id)) consumableEffectBus.emit');
    expect(game).toContain("GAMBLER_REGISTRY.get(id)?.effect.kind !== 'font'");
  });
});
