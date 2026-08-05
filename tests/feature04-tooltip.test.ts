/**
 * feature-04 B — the shared letter-tile tooltip spells out all three enhancement
 * axes (material / font / edition) SEPARATELY, each with its effect text (GDD §2.4).
 * Uses a key-echo `t` so we can assert exactly which strings the body pulls in.
 */
import { describe, it, expect } from 'vitest';
import { tileTooltip } from '../src/ui/game';
import { jokerTooltip, referencedEditionTips } from '../src/ui/descriptions';
import {
  splitTooltipDetails,
  stripTooltipPeriods,
  supplementalTooltipWidth,
} from '../src/ui/components/Tooltip';
import type { Tile } from '../src/engine/types';

// key-echo translator: returns the key itself (params ignored) so assertions can
// check precisely which locale keys the tooltip composes.
const t = (key: string | string[]) => Array.isArray(key) ? key[0]! : key;

const tile = (over: Partial<Tile> = {}): Tile => ({
  id: 't', letter: 'C', material: 'ceramic', font: 'medium', edition: 'base', ...over,
});

describe('feature-04 B — shared tile tooltip (3 axes, GDD §2.4)', () => {
  it('a plain tile shows only its chip value — no enhancement tags or definitions', () => {
    const { body, tags, sub } = tileTooltip(tile(), t);
    expect(body).toBe('tile.chips');
    expect(tags).toEqual([]);
    expect(sub).toEqual([]);
  });

  it('stacks all three enhancement tags in material, font, edition priority order', () => {
    const { title, body, tags, sub } = tileTooltip(
      tile({ material: 'leadPlate', font: 'lightItalic', edition: 'gray' }),
      t,
    );
    expect(title).toBe('C');
    expect(body).toBe('tile.chips');
    expect(tags).toEqual([
      { label: 'material.leadPlate', tone: 'material' },
      { label: 'font.lightItalic', tone: 'font' },
      { label: 'edition.gray', tone: 'gray' },
    ]);
    expect(sub).toEqual([
      { title: 'material.leadPlate', body: 'materialdesc.leadPlate', kind: 'material' },
      { title: 'font.lightItalic', body: 'fonteffectdesc.goldPlay', kind: 'font' },
      { title: 'edition.gray', body: 'editiondesc.gray', kind: 'edition' },
    ]);
  });

  it('folds the highest-priority detail into the main card only when two or more exist', () => {
    const details = tileTooltip(
      tile({ material: 'leadPlate', font: 'lightItalic', edition: 'gray' }),
      t,
    ).sub;

    expect(splitTooltipDetails(details.slice(0, 1))).toEqual({
      inline: null,
      left: [details[0]],
    });
    expect(splitTooltipDetails(details.slice(0, 2))).toEqual({
      inline: details[0],
      left: [details[1]],
    });
    expect(splitTooltipDetails(details)).toEqual({
      inline: details[0],
      left: [details[1], details[2]],
    });
  });

  it('uses semantic priority for automatic details and removes duplicate definitions', () => {
    const font = { title: 'Black', body: 'Retrigger once', kind: 'font' as const };
    const edition = { title: 'Gray', body: '+20 Chips', kind: 'edition' as const };
    expect(splitTooltipDetails([edition, font, { ...font }])).toEqual({
      inline: font,
      left: [edition],
    });
  });

  it('keeps all three referenced editions to the left, as on Cowherd and Weaver Girl', () => {
    const editions = referencedEditionTips('[G:Gray], [v:Violet], or [r:Rainbow]', t);
    expect(editions).toHaveLength(3);
    expect(splitTooltipDetails(editions)).toEqual({ inline: null, left: editions });
  });

  it('a Stone tile (no glyph) titles by its material name', () => {
    const stone = tile({ material: 'stone', letter: null });
    expect(tileTooltip(stone, t).title).toBe('material.stone');
    expect(tileTooltip(stone, (key, params) => `${key}:${params?.n}`).body)
      .toBe('tile.chips:50');
  });

  it('an Emoji Tile tooltip names its edition and effect', () => {
    expect(jokerTooltip('stargazer', 'white', t)).toEqual({
      body: 'jokerdesc.stargazer',
      tags: [{ label: 'edition.white', tone: 'white' }],
      sub: [{ title: 'edition.white', body: 'editiondesc.white', kind: 'edition' }],
    });
  });

  it('turns inner periods into line breaks, drops terminal periods, and keeps decimals', () => {
    expect(stripTooltipPeriods('Gain Chips. Current ×1.5.\n끝. 다음。'))
      .toBe('Gain Chips\nCurrent ×1.5\n끝\n다음');
  });

  it('sizes supplemental cards from visible text rather than rich-text markup', () => {
    const short = supplementalTooltipWidth({ title: 'Black', body: '[c:+2 Chips]' });
    const long = supplementalTooltipWidth({
      title: 'Black',
      body: '[c:+2 Chips] and retrigger the selected tile one additional time',
    });
    expect(short).toBe(148);
    expect(long).toBeGreaterThan(short);
  });
});
