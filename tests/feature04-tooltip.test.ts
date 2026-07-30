/**
 * feature-04 B — the shared letter-tile tooltip spells out all three enhancement
 * axes (material / font / edition) SEPARATELY, each with its effect text (GDD §2.4).
 * Uses a key-echo `t` so we can assert exactly which strings the body pulls in.
 */
import { describe, it, expect } from 'vitest';
import { tileTooltip } from '../src/ui/game';
import { jokerTooltipBody } from '../src/ui/descriptions';
import type { Tile } from '../src/engine/types';

// key-echo translator: returns the key itself (params ignored) so assertions can
// check precisely which locale keys the tooltip composes.
const t = (key: string | string[]) => Array.isArray(key) ? key[0]! : key;

const tile = (over: Partial<Tile> = {}): Tile => ({
  id: 't', letter: 'C', material: 'ceramic', font: 'medium', edition: 'base', ...over,
});

describe('feature-04 B — shared tile tooltip (3 axes, GDD §2.4)', () => {
  it('a plain tile shows only its chip value — no axis lines', () => {
    const { body } = tileTooltip(tile(), t);
    expect(body).toBe('tile.chips');
    expect(body).not.toContain('material.');
    expect(body).not.toContain('font.');
    expect(body).not.toContain('edition.');
  });

  it('acceptance: a Light-Italic Lead-plate Gray tile reads all three in one hover', () => {
    const { title, body } = tileTooltip(
      tile({ material: 'leadPlate', font: 'lightItalic', edition: 'gray' }),
      t,
    );
    expect(title).toBe('C');
    const lines = body.split('\n');
    expect(lines).toHaveLength(4); // chips + material + font + edition
    // material axis: name + its effect
    expect(body).toContain('material.leadPlate');
    expect(body).toContain('materialdesc.leadPlate');
    // font axis: name + effect (resolved through the balance mapping → goldPlay)
    expect(body).toContain('font.lightItalic');
    expect(body).toContain('fonteffectdesc.goldPlay');
    // edition axis: name + effect
    expect(body).toContain('edition.gray');
    expect(body).toContain('editiondesc.gray');
  });

  it('a Stone tile (no glyph) titles by its material name', () => {
    expect(tileTooltip(tile({ material: 'stone', letter: null }), t).title).toBe('material.stone');
  });

  it('an Emoji Tile tooltip names its edition and effect', () => {
    const body = jokerTooltipBody('stargazer', 'white', t);
    expect(body).toContain('jokerdesc.stargazer');
    expect(body).toContain('edition.white');
    expect(body).toContain('editiondesc.white');
  });
});
